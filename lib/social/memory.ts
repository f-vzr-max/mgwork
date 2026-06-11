// Candidate long-term memory.
//
// The LLM may emit a `memory` object inside its <extracted> block — short,
// stable facts about the candidate worth remembering across sessions (e.g.
// "has_two_children": "yes"). We sanitise hard (key allowlist, value length
// cap, key-count cap), merge into Candidate.memory (JSONB) as a fact map
// `{ facts: { key: { value, at } }, summary? }`, and keep an optional rolling
// `summary` refreshed when the conversation history clips at MAX_HISTORY.
//
// Everything here is best-effort by contract: callers swallow failures —
// memory must never block a chat reply.

import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { chat } from "../claude";
import type { ConversationMessage } from "./types";

// Hard caps — the fact map is injected into every system prompt, so it must
// stay small enough not to blow the token budget.
export const MEMORY_MAX_KEYS = 40;
export const MEMORY_VALUE_MAX = 200;
export const MEMORY_SUMMARY_MAX = 600;

// Key allowlist: letter first, then letters/digits/_/./-, max 64 chars. This
// also keeps prompt injection via hostile keys out of the system prompt.
const MEMORY_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;

export type MemoryFact = { value: string; at: string };

export type CandidateMemory = {
  facts: Record<string, MemoryFact>;
  summary?: string;
  summaryAt?: string;
};

// Coerce the raw `memory` value from the extracted JSON into a clean
// key → value map. Unknown shapes, disallowed keys, non-string or empty
// values are dropped; values are clipped to MEMORY_VALUE_MAX.
export function sanitiseMemoryFacts(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MEMORY_MAX_KEYS) break;
    if (!MEMORY_KEY_RE.test(key)) continue;
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (v.length === 0) continue;
    out[key] = v.slice(0, MEMORY_VALUE_MAX);
  }
  return out;
}

// Defensive reader for the Candidate.memory JSON column — same spirit as the
// bridge's readHistory: old or foreign shapes must never crash the bridge.
export function readCandidateMemory(value: unknown): CandidateMemory {
  const memory: CandidateMemory = { facts: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) return memory;
  const obj = value as Record<string, unknown>;
  if (obj.facts && typeof obj.facts === "object" && !Array.isArray(obj.facts)) {
    for (const [k, f] of Object.entries(obj.facts as Record<string, unknown>)) {
      if (!MEMORY_KEY_RE.test(k) || !f || typeof f !== "object" || Array.isArray(f)) continue;
      const fv = (f as Record<string, unknown>).value;
      const at = (f as Record<string, unknown>).at;
      if (typeof fv !== "string" || fv.length === 0) continue;
      memory.facts[k] = {
        value: fv.slice(0, MEMORY_VALUE_MAX),
        at: typeof at === "string" ? at : new Date().toISOString(),
      };
    }
  }
  if (typeof obj.summary === "string" && obj.summary.trim().length > 0) {
    memory.summary = obj.summary.slice(0, MEMORY_SUMMARY_MAX);
  }
  if (typeof obj.summaryAt === "string") memory.summaryAt = obj.summaryAt;
  return memory;
}

// Merge new facts over existing ones — newest wins per key. When the merged
// map exceeds MEMORY_MAX_KEYS, the oldest entries (by `at`) are evicted.
export function mergeMemoryFacts(
  existing: Record<string, MemoryFact>,
  incoming: Record<string, string>,
  at: string = new Date().toISOString(),
): Record<string, MemoryFact> {
  const merged: Record<string, MemoryFact> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) merged[k] = { value: v, at };
  const keys = Object.keys(merged);
  if (keys.length <= MEMORY_MAX_KEYS) return merged;
  const kept = keys
    .sort((a, b) => (merged[a].at < merged[b].at ? 1 : -1))
    .slice(0, MEMORY_MAX_KEYS);
  const out: Record<string, MemoryFact> = {};
  for (const k of kept) out[k] = merged[k];
  return out;
}

// Read-merge-write the fact map onto Candidate.memory.
export async function persistMemoryFacts(
  candidateId: string,
  incoming: Record<string, string>,
): Promise<void> {
  if (Object.keys(incoming).length === 0) return;
  const row = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { memory: true },
  });
  if (!row) return;
  const memory = readCandidateMemory(row.memory);
  memory.facts = mergeMemoryFacts(memory.facts, incoming);
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { memory: memory as unknown as Prisma.InputJsonValue },
  });
}

// Refresh memory.summary from the (already clipped) transcript with ONE
// fast/Haiku call. Fire-and-forget by design: never escalates to the smart
// tier, never throws — a failed refresh just means we retry at the next clip.
export async function refreshMemorySummary(
  candidateId: string,
  history: ConversationMessage[],
): Promise<void> {
  try {
    if (history.length === 0) return;
    const transcript = history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n")
      // Keep the tail — the head is what just fell off the window anyway.
      .slice(-12_000);
    const result = await chat({
      system:
        "Summarize what is durably known about this job candidate from the conversation below " +
        "(profile facts, preferences, constraints, open questions). Plain text, no preamble, " +
        `at most ${MEMORY_SUMMARY_MAX} characters. Write in the language the user writes in.`,
      messages: [{ role: "user", content: transcript }],
      maxTokens: 300,
    });
    if ("error" in result) return;
    const summary = result.text.trim().slice(0, MEMORY_SUMMARY_MAX);
    if (!summary) return;
    const row = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { memory: true },
    });
    if (!row) return;
    const memory = readCandidateMemory(row.memory);
    memory.summary = summary;
    memory.summaryAt = new Date().toISOString();
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { memory: memory as unknown as Prisma.InputJsonValue },
    });
  } catch {
    // silent — memory summary is best-effort by design
  }
}
