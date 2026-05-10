// LLM bridge — main loop that turns one user message into one assistant reply.
//
// Steps:
//   1. Load (or create) the Conversation row for {candidateId, platform=IN_APP}
//      — for now the bridge persists all transcripts under IN_APP regardless
//      of inbound platform. (Per-platform threading can be added later by
//      passing `platform` through; the schema already enforces uniqueness on
//      `[candidateId, platform]`.)
//   2. Build the system prompt with the candidate's locale.
//   3. Append the new user turn to the in-memory message log, call Claude.
//   4. Parse `<extracted>{...}</extracted>` from the assistant reply.
//   5. Update Candidate fields (skills, sectors, langScoreFR/EN, city,
//      firstName, lastName, dateOfBirth) when present and well-typed.
//   6. Persist the user + assistant turns to Conversation.history (clipped to
//      MAX_HISTORY messages to bound storage).
//   7. Return the conversational reply (the part after the </extracted> tag,
//      or the full text if no extracted block was found).

import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { chat, type ChatMessage } from "../claude";
import { assertSafeForLLM } from "../aidefence";
import type { ConversationMessage } from "./types";

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
};

export type BridgeResult =
  | { ok: true; reply: string; extracted: ExtractedFields | null }
  | { ok: false; error: "no-key" | "api-error" | "candidate-missing"; message?: string };

const SYSTEM_PROMPT_TEMPLATE = `You are MG Work's onboarding agent. Your goal is to collect:
- first/last name, date of birth, city
- 3+ skills, 1+ sectors of interest
- French and English self-assessed level
- mobility (willing to relocate to Mauritius? when?)

Respond concisely in {{lang}}. After each user message, output a JSON block with extracted fields:
<extracted>{ "skills": [...], ... }</extracted>
Then your conversational reply.`;

function buildSystemPrompt(lang: BridgeLang): string {
  return SYSTEM_PROMPT_TEMPLATE.replace("{{lang}}", localeLabel(lang));
}

function localeLabel(lang: BridgeLang): string {
  switch (lang) {
    case "FR":
      return "French";
    case "EN":
      return "English";
    case "MG":
      return "Malagasy";
  }
}

// Heuristic-typed reader for prior history JSON. We intentionally allow
// older message shapes (without `at` for example) — defensive and forward
// compatible.
function readHistory(value: unknown): ConversationMessage[] {
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

function clipHistory(history: ConversationMessage[]): ConversationMessage[] {
  if (history.length <= MAX_HISTORY) return history;
  return history.slice(history.length - MAX_HISTORY);
}

function toChatMessages(history: ConversationMessage[]): ChatMessage[] {
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
  return out;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Apply extracted fields to the Candidate row. We MERGE arrays (skills,
// sectors) — never replace — so the LLM can incrementally surface new items
// without dropping prior collection.
async function persistExtracted(candidateId: string, extracted: ExtractedFields): Promise<void> {
  const data: Prisma.CandidateUpdateInput = {};

  if (extracted.firstName) data.firstName = extracted.firstName;
  if (extracted.lastName) data.lastName = extracted.lastName;
  if (extracted.city) data.city = extracted.city;
  if (extracted.dateOfBirth) {
    const d = new Date(extracted.dateOfBirth);
    if (!Number.isNaN(d.getTime())) data.dateOfBirth = d;
  }
  if (typeof extracted.langScoreFR === "number") data.langScoreFR = extracted.langScoreFR;
  if (typeof extracted.langScoreEN === "number") data.langScoreEN = extracted.langScoreEN;

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

// Load (or create) the IN_APP conversation row for this candidate.
async function loadInAppConversation(candidateId: string): Promise<{
  id: string;
  history: ConversationMessage[];
}> {
  const existing = await prisma.conversation.findUnique({
    where: {
      candidateId_platform: { candidateId, platform: "IN_APP" },
    },
    select: { id: true, history: true },
  });
  if (existing) {
    return { id: existing.id, history: readHistory(existing.history) };
  }
  const created = await prisma.conversation.create({
    data: {
      candidateId,
      platform: "IN_APP",
      history: [] as Prisma.InputJsonValue,
    },
    select: { id: true, history: true },
  });
  return { id: created.id, history: [] };
}

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

export type ProcessParams = {
  candidateId: string;
  incomingText: string;
  lang: BridgeLang;
};

// Main entry point. Throws AIDefenceError when the input is unsafe — the
// caller (route handler) is responsible for catching and returning 400.
export async function process(params: ProcessParams): Promise<BridgeResult> {
  // Defense: block obvious prompt-injection markers before anything else.
  assertSafeForLLM(params.incomingText);

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    select: { id: true },
  });
  if (!candidate) {
    return { ok: false, error: "candidate-missing" };
  }

  const conv = await loadInAppConversation(params.candidateId);
  const userTurn: ConversationMessage = {
    role: "user",
    text: params.incomingText,
    at: new Date().toISOString(),
  };
  const transcript = [...conv.history, userTurn];

  const result = await chat({
    system: buildSystemPrompt(params.lang),
    messages: toChatMessages(transcript),
    model: "smart",
    maxTokens: 1024,
  });

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

  if (extracted) {
    try {
      await persistExtracted(params.candidateId, extracted);
    } catch {
      // Field updates are best-effort — never block a chat reply on them.
    }
  }

  return { ok: true, reply, extracted };
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
