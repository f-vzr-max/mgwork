// AI input safety guard.
//
// Any user-supplied free text that gets concatenated into a Claude prompt
// (chat composer, CV extraction OCR feedback, interview answers, etc.) must
// pass through `assertSafeForLLM` first. This is a regex-based first line of
// defense; the swarm pattern is to swap to the `aidefence_scan` MCP tool once
// it's wired in. Until then we err on the side of blocking obvious markers.
//
// TODO: replace internal scoring with `aidefence_scan` MCP call once available.

export const MAX_USER_TEXT_LENGTH = 10_000;

export type ScanVerdict = {
  safe: boolean;
  reasons: string[];
  // Truncated preview (first 80 chars) for forensic logs — never log full text.
  preview: string;
};

// Patterns that indicate prompt injection attempts. Case-insensitive, anchored
// loosely so simple obfuscation ("ig nore previous") still partially trips.
// Kept conservative — false positives are acceptable; false negatives are not.
const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "ignore_previous", re: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)/i },
  { name: "disregard_instructions", re: /disregard\s+(the\s+)?(previous|prior|above|all)\s+(instructions?|prompts?)/i },
  { name: "forget_instructions", re: /forget\s+(everything|all|previous|prior)\s+(instructions?|context|messages?)?/i },
  { name: "system_role_marker", re: /^\s*system\s*:\s*/im },
  { name: "system_tag", re: /<\s*\/?\s*system\s*>/i },
  { name: "assistant_tag", re: /<\s*\/?\s*assistant\s*>/i },
  { name: "human_tag_open", re: /\bHuman\s*:\s*\n/ },
  { name: "new_instructions", re: /new\s+instructions?\s*:/i },
  { name: "you_are_now", re: /you\s+are\s+now\s+(a\s+)?[a-z]+\s*(assistant|model|ai|bot)/i },
  { name: "developer_mode", re: /developer\s+mode|dan\s+mode|jailbreak/i },
  { name: "reveal_prompt", re: /(reveal|show|print|output|repeat)\s+(your\s+)?(system\s+)?(prompt|instructions)/i },
  { name: "extracted_block_injection", re: /<\s*extracted\s*>/i },
  // Anthropic-specific markers
  { name: "anthropic_role_marker", re: /\\n\\nHuman:|\\n\\nAssistant:/ },
];

export function scanUserText(text: string): ScanVerdict {
  const reasons: string[] = [];
  const preview = text.slice(0, 80).replace(/\s+/g, " ");

  if (typeof text !== "string") {
    return { safe: false, reasons: ["not_a_string"], preview: "" };
  }

  if (text.length > MAX_USER_TEXT_LENGTH) {
    reasons.push(`length_exceeds_${MAX_USER_TEXT_LENGTH}`);
  }

  // Block null bytes / control chars (except tab/newline/CR) — common smuggling vector.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    reasons.push("control_chars");
  }

  for (const { name, re } of INJECTION_PATTERNS) {
    if (re.test(text)) {
      reasons.push(`pattern:${name}`);
    }
  }

  return { safe: reasons.length === 0, reasons, preview };
}

export class AIDefenceError extends Error {
  readonly reasons: string[];
  readonly preview: string;
  constructor(verdict: ScanVerdict) {
    super(`aidefence: input rejected (${verdict.reasons.join(",")})`);
    this.name = "AIDefenceError";
    this.reasons = verdict.reasons;
    this.preview = verdict.preview;
  }
}

/**
 * Throws AIDefenceError if the text is unsafe to send to Claude.
 * Use at the top of every API route that takes free-form user text and
 * forwards it to an LLM.
 */
export function assertSafeForLLM(text: string): void {
  const verdict = scanUserText(text);
  if (!verdict.safe) {
    throw new AIDefenceError(verdict);
  }
}

/**
 * Best-effort sanitizer for cases where rejecting the request is not an
 * option (e.g. a long candidate bio with one borderline phrase). Strips known
 * markers but does NOT make arbitrary text safe — `assertSafeForLLM` is still
 * the right call for anything fed verbatim into a system prompt.
 */
export function sanitizeForLLM(text: string): string {
  let out = text.slice(0, MAX_USER_TEXT_LENGTH);
  for (const { re } of INJECTION_PATTERNS) {
    out = out.replace(re, "[redacted]");
  }
  return out;
}
