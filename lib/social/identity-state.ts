// Channel identity per-sender state: reserved pendingExtract keys + rate
// accounting (split out of lib/social/identity.ts for size).
//
// Rate caps (DB counters on ChannelIdentity — msgCountDay/msgWindowStart hold
// the daily window; the 15-min burst, anonymous-turn and cap-notice state live
// under reserved `__`-prefixed keys in pendingExtract because the schema has
// exactly one counter pair):
//   - linked:    LINKED_BURST_MAX msgs / 15 min  AND  LINKED_DAY_MAX / day
//   - anonymous: ANON_TURNS_MAX total turns, then linking is required
// Over-cap → ONE polite canned notice per window, then silence. The bridge's
// persistPendingExtract spreads existing keys, so reserved state survives its
// writes; identity.ts skips `__` keys when replaying extract onto a Candidate.

import type { ChannelIdentity, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export const LINKED_BURST_MAX = 10;
export const BURST_WINDOW_MS = 15 * 60_000;
export const LINKED_DAY_MAX = 60;
export const ANON_TURNS_MAX = 15;

// ---------------------------------------------------------------------------
// Reserved (non-extract) state stored under pendingExtract `__` keys
// ---------------------------------------------------------------------------

export type ReservedState = {
  rate?: { ws: string; n: number };
  anonTurns?: number;
  phoneMatch?: { candidateId: string; at: string; declined?: boolean };
  capNotice?: { scope: "burst" | "day" | "anon"; at: string };
  // Failed link-code redemptions per burst window (redemption bypasses the
  // normal rate caps, so guesses get their own counter — see identity.ts).
  linkFails?: { ws: string; n: number };
};

export function readReserved(pendingExtract: unknown): ReservedState {
  if (!pendingExtract || typeof pendingExtract !== "object" || Array.isArray(pendingExtract)) {
    return {};
  }
  const pe = pendingExtract as Record<string, unknown>;
  const out: ReservedState = {};
  const rate = pe.__rate as { ws?: unknown; n?: unknown } | undefined;
  if (rate && typeof rate.ws === "string" && typeof rate.n === "number") {
    out.rate = { ws: rate.ws, n: rate.n };
  }
  if (typeof pe.__anonTurns === "number") out.anonTurns = pe.__anonTurns;
  const pm = pe.__phoneMatch as
    | { candidateId?: unknown; at?: unknown; declined?: unknown }
    | undefined;
  if (pm && typeof pm.candidateId === "string" && typeof pm.at === "string") {
    out.phoneMatch = {
      candidateId: pm.candidateId,
      at: pm.at,
      ...(pm.declined === true ? { declined: true } : {}),
    };
  }
  const cn = pe.__capNotice as { scope?: unknown; at?: unknown } | undefined;
  if (cn && (cn.scope === "burst" || cn.scope === "day" || cn.scope === "anon") && typeof cn.at === "string") {
    out.capNotice = { scope: cn.scope, at: cn.at };
  }
  const lf = pe.__linkFails as { ws?: unknown; n?: unknown } | undefined;
  if (lf && typeof lf.ws === "string" && typeof lf.n === "number") {
    out.linkFails = { ws: lf.ws, n: lf.n };
  }
  return out;
}

// Read-merge-write the reserved keys back, preserving every non-reserved
// (extract) key the bridge may have written meanwhile.
export async function writeReserved(
  channelIdentityId: string,
  reserved: ReservedState,
): Promise<void> {
  const row = await prisma.channelIdentity.findUnique({
    where: { id: channelIdentityId },
    select: { pendingExtract: true },
  });
  const existing =
    row?.pendingExtract && typeof row.pendingExtract === "object" && !Array.isArray(row.pendingExtract)
      ? (row.pendingExtract as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...existing };
  delete next.__rate;
  delete next.__anonTurns;
  delete next.__phoneMatch;
  delete next.__capNotice;
  delete next.__linkFails;
  if (reserved.rate) next.__rate = reserved.rate;
  if (typeof reserved.anonTurns === "number") next.__anonTurns = reserved.anonTurns;
  if (reserved.phoneMatch) next.__phoneMatch = reserved.phoneMatch;
  if (reserved.capNotice) next.__capNotice = reserved.capNotice;
  if (reserved.linkFails) next.__linkFails = reserved.linkFails;
  await prisma.channelIdentity.update({
    where: { id: channelIdentityId },
    data: { pendingExtract: next as Prisma.InputJsonValue },
  });
}

// ---------------------------------------------------------------------------
// Rate accounting (pure on inputs; caller persists)
// ---------------------------------------------------------------------------

export type RateOutcome = {
  dayCount: number;
  windowStart: Date;
  over: "burst" | "day" | "anon" | null;
  notify: boolean;
};

export function accountMessage(
  identity: ChannelIdentity,
  reserved: ReservedState,
  now: Date,
): RateOutcome {
  const linked = identity.status === "LINKED";

  // Daily window on the columns: resets when the UTC day changes.
  const sameDay = identity.msgWindowStart !== null && isSameUtcDay(identity.msgWindowStart, now);
  const dayCount = (sameDay ? identity.msgCountDay : 0) + 1;
  const windowStart = sameDay && identity.msgWindowStart ? identity.msgWindowStart : now;

  // 15-min burst window (linked) under pendingExtract.__rate.
  let burst = reserved.rate;
  if (!burst || now.getTime() - Date.parse(burst.ws) > BURST_WINDOW_MS) {
    burst = { ws: now.toISOString(), n: 0 };
  }
  burst = { ws: burst.ws, n: burst.n + 1 };
  reserved.rate = burst;

  // Anonymous total-turn counter under pendingExtract.__anonTurns.
  if (!linked) reserved.anonTurns = (reserved.anonTurns ?? 0) + 1;

  let over: RateOutcome["over"] = null;
  if (linked) {
    if (burst.n > LINKED_BURST_MAX) over = "burst";
    else if (dayCount > LINKED_DAY_MAX) over = "day";
  } else if ((reserved.anonTurns ?? 0) > ANON_TURNS_MAX) {
    over = "anon";
  }

  // One polite notice per window, then silence: burst → once per burst window,
  // day → once per UTC day, anon → once ever (no window to reset it).
  let notify = false;
  if (over) {
    const prior = reserved.capNotice;
    const priorAt = prior ? Date.parse(prior.at) : NaN;
    const stillCurrent =
      prior?.scope === over &&
      (over === "burst"
        ? now.getTime() - priorAt <= BURST_WINDOW_MS
        : over === "day"
          ? isSameUtcDay(new Date(priorAt), now)
          : true);
    if (!stillCurrent) {
      notify = true;
      reserved.capNotice = { scope: over, at: now.toISOString() };
    }
  }

  return { dayCount, windowStart, over, notify };
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
