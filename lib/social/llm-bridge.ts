// LLM bridge — main loop that turns one user message into one assistant reply.
//
// Steps:
//   1. Load (or create) the Conversation row — keyed [candidateId, platform]
//      for linked candidates (platform defaults to IN_APP, so the in-app chat
//      behaves exactly as before), or by channelIdentityId for anonymous
//      (not-yet-linked) channel users (phase 0 of the channels design).
//   2. Build the system prompt: locale + known profile facts + memory for
//      candidates ("do not re-ask"), or a generic onboarding prompt for
//      anonymous users.
//   3. Append the new user turn to the in-memory message log, call Claude —
//      fast/Haiku first, ONE smart retry via `chatWithEscalation` (model
//      policy), unless `modelTier: "fast"` hard-pins Haiku with no retry.
//   4. Parse `<extracted>{...}</extracted>` from the assistant reply.
//   5. Persist extracted fields: Candidate columns + memory facts for
//      candidates; ChannelIdentity.pendingExtract for anonymous users.
//   6. Persist the user + assistant turns to Conversation.history (clipped to
//      MAX_HISTORY to bound storage); on clip, kick a best-effort fast-tier
//      memory.summary refresh (non-blocking).
//   7. Return the conversational reply (the part after the </extracted> tag,
//      or the full text if no extracted block was found).

import type { Prisma, SocialPlatform } from "@prisma/client";
import { prisma } from "../prisma";
import {
  chat,
  chatWithEscalation,
  type ChatMessage,
  type ChatResult,
  type ModelTier,
} from "../claude";
import { assertSafeForLLM, sanitizeForLLM } from "../aidefence";
import type { ConversationMessage } from "./types";
import {
  readCandidateMemory,
  sanitiseMemoryFacts,
  persistMemoryFacts,
  refreshMemorySummary,
  type CandidateMemory,
} from "./memory";

export const MAX_HISTORY = 50;

export type BridgeLang = "FR" | "EN" | "MG";

export type ExtractedFields = {
  firstName?: string;
  lastName?: string;
  city?: string;
  dateOfBirth?: string; // ISO date
  skills?: string[];
  sectors?: string[];
  langScoreFR?: number;
  langScoreEN?: number;
  // Mobility (free text) — surfaced for future use; not yet a Candidate column.
  mobility?: string;
  // Short stable facts worth remembering across sessions (sanitised hard in
  // lib/social/memory.ts — key allowlist, value/key-count caps).
  memory?: Record<string, string>;
};

export type BridgeResult =
  | { ok: true; reply: string; extracted: ExtractedFields | null; escalated: boolean }
  | {
      ok: false;
      error: "no-key" | "api-error" | "candidate-missing" | "identity-missing";
      message?: string;
    };

const SYSTEM_PROMPT_TEMPLATE = `You are AsanaoConnect's onboarding agent. Your goal is to collect:
- first/last name, date of birth, city
- 3+ skills, 1+ sectors of interest
- French and English self-assessed level
- mobility (willing to relocate to Mauritius? when?)

Respond concisely in {{lang}}. After each user message, output a JSON block with extracted fields:
<extracted>{ "skills": [...], ... }</extracted>
The block may also carry a "memory" object of short stable facts worth remembering across sessions (snake_case keys, short string values), e.g. "memory": { "target_departure": "March 2027" }.
Then your conversational reply.`;

// Generic prompt for anonymous (unlinked) channel users — no Candidate row
// exists yet, so we introduce the platform and collect the same basics; the
// extracted fields land on ChannelIdentity.pendingExtract until linking.
const ANON_SYSTEM_PROMPT_TEMPLATE = `You are AsanaoConnect's onboarding agent, talking to a NEW user on {{platform}} who is not linked to an AsanaoConnect account yet. Briefly introduce AsanaoConnect (jobs in Mauritius for Malagasy candidates), then conversationally collect:
- first/last name, city
- skills and sectors of interest
- French and English self-assessed level
Invite them to create an account on the AsanaoConnect website (or share the link code from their profile) so this chat can be connected to it.

Respond concisely in {{lang}}. After each user message, output a JSON block with extracted fields:
<extracted>{ "skills": [...], ... }</extracted>
Then your conversational reply.`;

function buildSystemPrompt(lang: BridgeLang, knownLines: string[] = []): string {
  const base = SYSTEM_PROMPT_TEMPLATE.replace("{{lang}}", localeLabel(lang));
  if (knownLines.length === 0) return base;
  return `${base}\n\nKnown about this user — do not re-ask:\n${knownLines
    .map((l) => `- ${l}`)
    .join("\n")}`;
}

function buildAnonSystemPrompt(lang: BridgeLang, platform: SocialPlatform): string {
  return ANON_SYSTEM_PROMPT_TEMPLATE.replace("{{lang}}", localeLabel(lang)).replace(
    "{{platform}}",
    platform,
  );
}

// Exported for reuse by lib/social/enterprise-assistant.ts.
export function localeLabel(lang: BridgeLang): string {
  switch (lang) {
    case "FR":
      return "French";
    case "EN":
      return "English";
    case "MG":
      return "Malagasy";
  }
}

// Heuristic-typed reader for prior history JSON — tolerates older message
// shapes (no `at`, etc.). Exported for reuse by enterprise-assistant.ts.
export function readHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const out: ConversationMessage[] = [];
  for (const m of value) {
    if (!m || typeof m !== "object") continue;
    const r = (m as Record<string, unknown>).role;
    const t = (m as Record<string, unknown>).text;
    if ((r !== "user" && r !== "assistant") || typeof t !== "string") continue;
    const at = (m as Record<string, unknown>).at;
    out.push({
      role: r,
      text: t,
      at: typeof at === "string" ? at : new Date().toISOString(),
    });
  }
  return out;
}

export function clipHistory(history: ConversationMessage[]): ConversationMessage[] {
  if (history.length <= MAX_HISTORY) return history;
  return history.slice(history.length - MAX_HISTORY);
}

export function toChatMessages(history: ConversationMessage[]): ChatMessage[] {
  return history.map((m) => ({ role: m.role, content: m.text }));
}

const EXTRACTED_RE = /<extracted>([\s\S]*?)<\/extracted>/i;

// Pull the JSON block out of the assistant reply. Returns the parsed object
// (or null) AND the remaining text with the tag block stripped. The block is
// removed from the reply we return to the user — they should never see raw
// JSON.
export function parseAssistantOutput(text: string): { reply: string; extracted: ExtractedFields | null } {
  const m = EXTRACTED_RE.exec(text);
  if (!m) return { reply: text.trim(), extracted: null };
  const jsonRaw = m[1].trim();
  const reply = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch {
    return { reply, extracted: null };
  }
  if (!parsed || typeof parsed !== "object") {
    return { reply, extracted: null };
  }
  const extracted = sanitiseExtracted(parsed as Record<string, unknown>);
  return { reply, extracted };
}

// Coerce raw extracted JSON into our typed shape, dropping unknown keys and
// rejecting malformed values. We never pass raw JSON to Prisma.
function sanitiseExtracted(raw: Record<string, unknown>): ExtractedFields {
  const out: ExtractedFields = {};
  if (typeof raw.firstName === "string" && raw.firstName.trim().length > 0) {
    out.firstName = raw.firstName.trim().slice(0, 120);
  }
  if (typeof raw.lastName === "string" && raw.lastName.trim().length > 0) {
    out.lastName = raw.lastName.trim().slice(0, 120);
  }
  if (typeof raw.city === "string" && raw.city.trim().length > 0) {
    out.city = raw.city.trim().slice(0, 120);
  }
  if (typeof raw.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.dateOfBirth)) {
    // store the ISO date prefix only — caller decides how to coerce.
    out.dateOfBirth = raw.dateOfBirth.slice(0, 10);
  }
  if (Array.isArray(raw.skills)) {
    out.skills = raw.skills
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 50);
  }
  if (Array.isArray(raw.sectors)) {
    out.sectors = raw.sectors
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 20);
  }
  if (typeof raw.langScoreFR === "number" && Number.isFinite(raw.langScoreFR)) {
    out.langScoreFR = clampInt(raw.langScoreFR, 0, 100);
  }
  if (typeof raw.langScoreEN === "number" && Number.isFinite(raw.langScoreEN)) {
    out.langScoreEN = clampInt(raw.langScoreEN, 0, 100);
  }
  if (typeof raw.mobility === "string" && raw.mobility.trim().length > 0) {
    out.mobility = raw.mobility.trim().slice(0, 1000);
  }
  const memory = sanitiseMemoryFacts(raw.memory);
  if (Object.keys(memory).length > 0) out.memory = memory;
  return out;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Apply extracted fields to the Candidate row. We MERGE arrays (skills,
// sectors) — never replace — so the LLM can incrementally surface new items
// without dropping prior collection. Memory facts are merged separately via
// persistMemoryFacts.
async function persistExtracted(candidateId: string, extracted: ExtractedFields): Promise<void> {
  const data: Prisma.CandidateUpdateInput = {};

  if (extracted.firstName) data.firstName = extracted.firstName;
  if (extracted.lastName) data.lastName = extracted.lastName;
  if (extracted.city) data.city = extracted.city;
  if (extracted.dateOfBirth) {
    const d = new Date(extracted.dateOfBirth);
    if (!Number.isNaN(d.getTime())) data.dateOfBirth = d;
  }
  // Chat-extracted levels are SELF-CLAIMED. Only /api/ai/lang-test may set the
  // langScore*VerifiedAt stamps — any other langScore* write clears the
  // matching stamp so the "verified" badge never decorates an unverified score.
  if (typeof extracted.langScoreFR === "number") {
    data.langScoreFR = extracted.langScoreFR;
    data.langScoreFRVerifiedAt = null;
  }
  if (typeof extracted.langScoreEN === "number") {
    data.langScoreEN = extracted.langScoreEN;
    data.langScoreENVerifiedAt = null;
  }

  // For arrays, merge with existing (case-insensitive de-dupe).
  if (extracted.skills?.length || extracted.sectors?.length) {
    const existing = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { skills: true, sectors: true },
    });
    if (existing) {
      if (extracted.skills?.length) {
        data.skills = mergeUnique(existing.skills, extracted.skills);
      }
      if (extracted.sectors?.length) {
        data.sectors = mergeUnique(existing.sectors, extracted.sectors);
      }
    }
  }

  if (Object.keys(data).length === 0) return;

  await prisma.candidate.update({ where: { id: candidateId }, data });
}

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of existing) seen.set(v.toLowerCase(), v);
  for (const v of incoming) {
    const k = v.toLowerCase();
    if (!seen.has(k)) seen.set(k, v);
  }
  return Array.from(seen.values()).slice(0, 100);
}

// Anonymous (unlinked) channel users have no Candidate row yet — extracted
// fields accumulate on ChannelIdentity.pendingExtract until a downstream
// linker replays them. Scalars overwrite, arrays merge-dedupe, memory merges.
async function persistPendingExtract(
  channelIdentityId: string,
  extracted: ExtractedFields,
): Promise<void> {
  const row = await prisma.channelIdentity.findUnique({
    where: { id: channelIdentityId },
    select: { pendingExtract: true },
  });
  if (!row) return;
  const existing =
    row.pendingExtract && typeof row.pendingExtract === "object" && !Array.isArray(row.pendingExtract)
      ? (row.pendingExtract as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...existing };
  const { memory, skills, sectors, ...scalars } = extracted;
  for (const [k, v] of Object.entries(scalars)) {
    if (v !== undefined) next[k] = v;
  }
  if (skills?.length) next.skills = mergeUnique(asStringArray(existing.skills), skills);
  if (sectors?.length) next.sectors = mergeUnique(asStringArray(existing.sectors), sectors);
  if (memory && Object.keys(memory).length > 0) {
    next.memory = { ...sanitiseMemoryFacts(existing.memory), ...memory };
  }
  next.updatedAt = new Date().toISOString();
  await prisma.channelIdentity.update({
    where: { id: channelIdentityId },
    data: { pendingExtract: next as Prisma.InputJsonValue },
  });
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// Duck-typed P2002 check — survives mocked Prisma clients in tests. Exported
// for reuse by enterprise-assistant.ts (same find-then-create pattern).
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

// Load (or create) the conversation row for a linked candidate on a platform.
// Two concurrent first messages can race the create — the loser catches P2002
// and re-reads the winner's row instead of dropping the message.
async function loadCandidateConversation(
  candidateId: string,
  platform: SocialPlatform,
): Promise<{ id: string; history: ConversationMessage[] }> {
  const existing = await prisma.conversation.findUnique({
    where: {
      candidateId_platform: { candidateId, platform },
    },
    select: { id: true, history: true },
  });
  if (existing) {
    return { id: existing.id, history: readHistory(existing.history) };
  }
  try {
    const created = await prisma.conversation.create({
      data: {
        candidateId,
        platform,
        history: [] as Prisma.InputJsonValue,
      },
      select: { id: true, history: true },
    });
    return { id: created.id, history: [] };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await prisma.conversation.findUnique({
      where: { candidateId_platform: { candidateId, platform } },
      select: { id: true, history: true },
    });
    if (!winner) throw e;
    return { id: winner.id, history: readHistory(winner.history) };
  }
}

// Load (or create) the conversation row for an anonymous channel identity
// (one-to-one — Conversation.channelIdentityId is unique). Same P2002
// retry-once as loadCandidateConversation.
async function loadChannelConversation(
  channelIdentityId: string,
  platform: SocialPlatform,
): Promise<{ id: string; history: ConversationMessage[] }> {
  const existing = await prisma.conversation.findUnique({
    where: { channelIdentityId },
    select: { id: true, history: true },
  });
  if (existing) {
    return { id: existing.id, history: readHistory(existing.history) };
  }
  try {
    const created = await prisma.conversation.create({
      data: {
        channelIdentityId,
        platform,
        history: [] as Prisma.InputJsonValue,
      },
      select: { id: true, history: true },
    });
    return { id: created.id, history: [] };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await prisma.conversation.findUnique({
      where: { channelIdentityId },
      select: { id: true, history: true },
    });
    if (!winner) throw e;
    return { id: winner.id, history: readHistory(winner.history) };
  }
}

// Known limitation (accepted, low-frequency): this is a blind full-history
// overwrite after a multi-second LLM round-trip, so two interleaved messages
// on the SAME conversation can lose the slower writer's turns (last writer
// wins). An append primitive/version check would close it; not worth the
// migration for current volumes.
async function persistConversation(
  conversationId: string,
  history: ConversationMessage[],
): Promise<void> {
  const clipped = clipHistory(history);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { history: clipped as unknown as Prisma.InputJsonValue },
  });
}

// Build the "Known about this user — do not re-ask" lines from the profile
// row + memory. Keys/values are sanitised+clipped — safe to inline in the prompt.
function knownFactLines(
  c: {
    firstName: string;
    lastName: string;
    city: string | null;
    dateOfBirth: Date | null;
    skills: string[];
    sectors: string[];
    langScoreFR: number | null;
    langScoreEN: number | null;
  },
  memory: CandidateMemory,
): string[] {
  // Memory values and the rolling summary are model-emitted from user text and
  // were never scanned on the way in — strip injection markers and interior
  // newlines before they re-enter a system prompt (second-order injection).
  const promptSafe = (v: string) => sanitizeForLLM(v).replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  const name = `${c.firstName} ${c.lastName}`.trim();
  if (name) lines.push(`name: ${name}`);
  if (c.city) lines.push(`city: ${c.city}`);
  if (c.dateOfBirth) lines.push(`dateOfBirth: ${c.dateOfBirth.toISOString().slice(0, 10)}`);
  if (c.skills.length > 0) lines.push(`skills: ${c.skills.join(", ")}`);
  if (c.sectors.length > 0) lines.push(`sectors: ${c.sectors.join(", ")}`);
  if (typeof c.langScoreFR === "number") lines.push(`French level: ${c.langScoreFR}/100`);
  if (typeof c.langScoreEN === "number") lines.push(`English level: ${c.langScoreEN}/100`);
  for (const [k, f] of Object.entries(memory.facts)) lines.push(`${k}: ${promptSafe(f.value)}`);
  if (memory.summary) lines.push(`earlier conversation summary: ${promptSafe(memory.summary)}`);
  return lines;
}

export type ProcessParams = {
  incomingText: string;
  lang: BridgeLang;
  // Channel routing (phase 0 of the channels design). Exactly one of
  // candidateId / channelIdentityId should be set; candidateId wins when both
  // are present. platform defaults to IN_APP — the in-app candidate path
  // behaves exactly as before.
  candidateId?: string;
  channelIdentityId?: string;
  platform?: SocialPlatform;
  // Model policy: default (undefined) = fast/Haiku with ONE smart retry via
  // chatWithEscalation. "fast" hard-pins Haiku with NO retry (high-volume
  // webhook channels). "smart" is never honoured directly.
  modelTier?: ModelTier;
};

// Main entry point. Throws AIDefenceError when the input is unsafe — the
// caller (route handler) is responsible for catching and returning 400.
export async function process(params: ProcessParams): Promise<BridgeResult> {
  // Defense: block obvious prompt-injection markers before anything else.
  assertSafeForLLM(params.incomingText);

  const platform: SocialPlatform = params.platform ?? "IN_APP";

  // Resolve the channel: linked candidate or anonymous channel identity.
  let system: string;
  let conv: { id: string; history: ConversationMessage[] };
  if (params.candidateId) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        dateOfBirth: true,
        skills: true,
        sectors: true,
        langScoreFR: true,
        langScoreEN: true,
        memory: true,
      },
    });
    if (!candidate) {
      return { ok: false, error: "candidate-missing" };
    }
    const memory = readCandidateMemory(candidate.memory);
    system = buildSystemPrompt(params.lang, knownFactLines(candidate, memory));
    conv = await loadCandidateConversation(candidate.id, platform);
  } else if (params.channelIdentityId) {
    const identity = await prisma.channelIdentity.findUnique({
      where: { id: params.channelIdentityId },
      select: { id: true },
    });
    if (!identity) {
      return { ok: false, error: "identity-missing" };
    }
    system = buildAnonSystemPrompt(params.lang, platform);
    conv = await loadChannelConversation(identity.id, platform);
  } else {
    return { ok: false, error: "candidate-missing" };
  }

  const userTurn: ConversationMessage = {
    role: "user",
    text: params.incomingText,
    at: new Date().toISOString(),
  };
  const transcript = [...conv.history, userTurn];

  // Model policy: fast/Haiku always runs first; the escalation helper is the
  // only path to the smart tier. validate() catches a reply that is nothing
  // but the extracted block — the helper's empty-text check cannot see that.
  let result: ChatResult;
  let escalated = false;
  if (params.modelTier === "fast") {
    result = await chat({
      system,
      messages: toChatMessages(transcript),
      maxTokens: 1024,
    });
  } else {
    const r = await chatWithEscalation({
      system,
      messages: toChatMessages(transcript),
      maxTokens: 1024,
      validate: (res) => parseAssistantOutput(res.text).reply.length > 0,
    });
    escalated = r.escalated;
    result = r;
  }

  if ("error" in result) {
    // Persist the user turn even on failure so the UI can show their message.
    await persistConversation(conv.id, transcript).catch(() => {
      /* swallow */
    });
    if (result.error === "no-key") {
      return { ok: false, error: "no-key" };
    }
    return { ok: false, error: "api-error", message: result.message };
  }

  const { reply, extracted } = parseAssistantOutput(result.text);
  const assistantTurn: ConversationMessage = {
    role: "assistant",
    text: reply,
    at: new Date().toISOString(),
  };
  const nextHistory = [...transcript, assistantTurn];

  await persistConversation(conv.id, nextHistory);

  // History just clipped — refresh the rolling memory summary so context that
  // fell off the window survives. Fire-and-forget; failure is silent.
  if (params.candidateId && nextHistory.length > MAX_HISTORY) {
    void refreshMemorySummary(params.candidateId, clipHistory(nextHistory));
  }

  if (extracted) {
    try {
      if (params.candidateId) {
        await persistExtracted(params.candidateId, extracted);
        if (extracted.memory) {
          await persistMemoryFacts(params.candidateId, extracted.memory);
        }
      } else if (params.channelIdentityId) {
        await persistPendingExtract(params.channelIdentityId, extracted);
      }
    } catch {
      // Field updates are best-effort — never block a chat reply on them.
    }
  }

  return { ok: true, reply, extracted, escalated };
}

// Convenience: read the IN_APP transcript for a candidate without sending a
// new message. Used by the chat page server render.
export async function loadTranscript(candidateId: string): Promise<ConversationMessage[]> {
  const row = await prisma.conversation.findUnique({
    where: { candidateId_platform: { candidateId, platform: "IN_APP" } },
    select: { history: true },
  });
  if (!row) return [];
  return clipHistory(readHistory(row.history));
}
