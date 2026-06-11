// Channel identity resolution + linking (channels phase 0).
//
// Every inbound social message resolves to a ChannelIdentity row (upsert on
// [platform, externalUserId]). From there `handleInbound` decides ONE action:
//   - reply  — a canned message (link confirm/invalid, phone-match prompt,
//              rate-cap notice). Canned strings come from the i18n catalogs
//              (channels.* namespace) via tFor — linked users get their stored
//              locale, anonymous users the provider hint or FR.
//   - bridge — hand the text to lib/social/llm-bridge `process` keyed by
//              candidateId (linked) or channelIdentityId (anonymous).
//   - silent — drop (blocked identity, over-cap after the one notice, empty
//              referral-only event, …).
//
// Linking paths:
//   - "LINK <code>" text (any platform) or Messenger m.me referral ref —
//     redeems a one-time, expiry-checked ChannelLinkToken → status LINKED,
//     linkedVia TOKEN. Link attempts BYPASS rate silencing: an over-cap
//     anonymous user must still be able to link, otherwise the cap is a dead
//     end.
//   - WhatsApp phone digit-match — sets a pending confirm state; only an
//     explicit YES/OUI/ENY reply links (linkedVia PHONE_MATCH). Any other
//     reply withdraws the offer (never re-offered).
// On link, pendingExtract collected while anonymous is replayed onto the
// Candidate with the same merge semantics as the bridge's persistExtracted
// (scalars overwrite, arrays merge-dedupe, memory facts via
// persistMemoryFacts). Link/unlink are audit-logged.
//
// Rate caps live in lib/social/identity-state.ts (reserved pendingExtract
// keys + the msgCountDay/msgWindowStart daily window):
//   - linked:    10 msgs / 15 min  AND  60 msgs / day
//   - anonymous: 15 total turns, then linking is required
// Over-cap → ONE polite canned message per window, then silence.

import { randomInt } from "node:crypto";
import type { ChannelIdentity, Prisma, SocialPlatform } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { tFor, type Locale } from "../i18n";
import { persistMemoryFacts, sanitiseMemoryFacts } from "./memory";
import { BURST_WINDOW_MS, accountMessage, readReserved, writeReserved } from "./identity-state";
import type { IncomingMessage } from "./types";

export {
  ANON_TURNS_MAX,
  BURST_WINDOW_MS,
  LINKED_BURST_MAX,
  LINKED_DAY_MAX,
} from "./identity-state";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const LINK_CODE_TTL_MS = 15 * 60_000;
export const LINK_CODE_LENGTH = 8;
// Failed redemptions tolerated per burst window before the identity is
// silenced on further LINK attempts (guess throttle — redemption bypasses the
// normal rate caps by design, so failures get their own counter).
export const LINK_FAIL_MAX = 5;

// Unambiguous alphabet (no 0/O/1/I/L) — codes are typed by hand on a phone.
const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LINK_CODE_RE = /^link[\s:]+([a-z0-9]{6,12})$/i;
const YES_RE = /^(yes|oui|eny|y)[\s.!]*$/i;

// ---------------------------------------------------------------------------
// Action returned to the webhook route
// ---------------------------------------------------------------------------

export type InboundAction =
  | { kind: "reply"; text: string }
  | { kind: "bridge"; candidateId?: string; channelIdentityId?: string; lang: Locale }
  | { kind: "silent"; reason: string };

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

export async function resolveIdentity(
  platform: SocialPlatform,
  externalUserId: string,
): Promise<ChannelIdentity> {
  const args = {
    where: { platform_externalUserId: { platform, externalUserId } },
    create: { platform, externalUserId },
    update: {},
  };
  try {
    return await prisma.channelIdentity.upsert(args);
  } catch (e) {
    // The empty `update` makes Prisma emulate this upsert (read-then-create),
    // so two concurrent first messages can both take the create branch — the
    // loser retries once and lands on the update branch.
    if (!isUniqueViolation(e)) throw e;
    return prisma.channelIdentity.upsert(args);
  }
}

// ---------------------------------------------------------------------------
// Main inbound decision
// ---------------------------------------------------------------------------

export async function handleInbound(msg: IncomingMessage): Promise<InboundAction> {
  const identity = await resolveIdentity(msg.platform, msg.senderId);
  if (identity.status === "BLOCKED") return { kind: "silent", reason: "blocked" };

  const reserved = readReserved(identity.pendingExtract);
  const text = msg.text.trim();
  const anonLang: Locale = msg.langHint ?? "FR";

  // 1. Link redemption — checked BEFORE rate silencing (see header).
  const code = parseLinkCode(text) ?? normalizeRef(msg.referralRef);
  if (code) return redeemLinkCode(identity, code, anonLang);

  // 2. Pending WhatsApp phone-match confirmation.
  if (identity.status !== "LINKED" && reserved.phoneMatch && !reserved.phoneMatch.declined) {
    if (YES_RE.test(text)) {
      return confirmPhoneMatch(identity, reserved.phoneMatch.candidateId, anonLang);
    }
    // Any other reply withdraws the offer; fall through to normal handling.
    reserved.phoneMatch = { ...reserved.phoneMatch, declined: true };
  }

  // 3. Rate accounting (single write below covers counters + reserved state).
  const now = new Date();
  const rate = accountMessage(identity, reserved, now);
  await prisma.channelIdentity
    .update({
      where: { id: identity.id },
      data: { msgCountDay: rate.dayCount, msgWindowStart: rate.windowStart },
    })
    .catch(() => {
      /* counters are best-effort — never block a reply on them */
    });
  await writeReserved(identity.id, reserved).catch(() => {
    /* same */
  });
  if (rate.over) {
    if (rate.notify) {
      const lang =
        identity.status === "LINKED" && identity.candidateId
          ? await candidateLang(identity.candidateId)
          : anonLang;
      const key = rate.over === "anon" ? "channels.linkRequired" : "channels.rateLimited";
      return { kind: "reply", text: tFor(lang)(key) };
    }
    return { kind: "silent", reason: `rate-${rate.over}` };
  }

  // 4. Linked → bridge as the candidate.
  if (identity.status === "LINKED" && identity.candidateId) {
    return {
      kind: "bridge",
      candidateId: identity.candidateId,
      lang: await candidateLang(identity.candidateId),
    };
  }

  // 5. Anonymous. WhatsApp sender ids are phone digits — offer a phone match
  //    once (never re-offered after a decline).
  if (msg.platform === "WHATSAPP" && !reserved.phoneMatch) {
    const matchId = await findCandidateByPhone(msg.senderId);
    if (matchId) {
      reserved.phoneMatch = { candidateId: matchId, at: now.toISOString() };
      await writeReserved(identity.id, reserved).catch(() => {});
      return { kind: "reply", text: tFor(anonLang)("channels.phoneMatchPrompt") };
    }
  }

  if (!text) return { kind: "silent", reason: "empty" };
  return { kind: "bridge", channelIdentityId: identity.id, lang: anonLang };
}

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

export function parseLinkCode(text: string): string | null {
  const m = LINK_CODE_RE.exec(text);
  return m ? m[1].toUpperCase() : null;
}

function normalizeRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const clean = ref.trim().toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(clean) ? clean : null;
}

async function redeemLinkCode(
  identity: ChannelIdentity,
  code: string,
  anonLang: Locale,
): Promise<InboundAction> {
  const now = new Date();

  // Guess throttle: redemption bypasses the normal rate caps (see header), so
  // FAILED attempts get their own per-identity counter — LINK_FAIL_MAX per
  // burst window, then silence until the window rolls. A valid code resets it.
  const reserved = readReserved(identity.pendingExtract);
  const failsCurrent =
    reserved.linkFails && now.getTime() - Date.parse(reserved.linkFails.ws) <= BURST_WINDOW_MS
      ? reserved.linkFails
      : null;
  if (failsCurrent && failsCurrent.n >= LINK_FAIL_MAX) {
    return { kind: "silent", reason: "link-fails" };
  }
  const fail = async (): Promise<InboundAction> => {
    reserved.linkFails = {
      ws: failsCurrent?.ws ?? now.toISOString(),
      n: (failsCurrent?.n ?? 0) + 1,
    };
    await writeReserved(identity.id, reserved).catch(() => {});
    return { kind: "reply", text: tFor(anonLang)("channels.linkInvalid") };
  };

  const token = await prisma.channelLinkToken.findUnique({ where: { code } });
  const valid =
    token &&
    !token.usedAt &&
    token.expiresAt.getTime() > now.getTime() &&
    (!token.platform || token.platform === identity.platform);
  if (!token || !valid) {
    return fail();
  }
  // One-time guarantee under concurrent retries: claim atomically.
  const claimed = await prisma.channelLinkToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    return fail();
  }
  if (reserved.linkFails) {
    delete reserved.linkFails;
    await writeReserved(identity.id, reserved).catch(() => {});
  }
  await linkIdentity(identity, token.candidateId, "TOKEN");
  return {
    kind: "reply",
    text: tFor(await candidateLang(token.candidateId))("channels.linkSuccess"),
  };
}

async function confirmPhoneMatch(
  identity: ChannelIdentity,
  candidateId: string,
  anonLang: Locale,
): Promise<InboundAction> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true },
  });
  if (!candidate) {
    // Candidate vanished since the offer — withdraw silently.
    const reserved = readReserved(identity.pendingExtract);
    if (reserved.phoneMatch) reserved.phoneMatch = { ...reserved.phoneMatch, declined: true };
    await writeReserved(identity.id, reserved).catch(() => {});
    return { kind: "reply", text: tFor(anonLang)("channels.linkInvalid") };
  }
  await linkIdentity(identity, candidateId, "PHONE_MATCH");
  return {
    kind: "reply",
    text: tFor(await candidateLang(candidateId))("channels.linkSuccess"),
  };
}

async function linkIdentity(
  identity: ChannelIdentity,
  candidateId: string,
  method: "TOKEN" | "PHONE_MATCH" | "MANUAL",
): Promise<void> {
  await prisma.channelIdentity.update({
    where: { id: identity.id },
    data: { candidateId, status: "LINKED", linkedVia: method },
  });
  // Best-effort follow-ups — linking itself must not fail on them.
  await replayPendingExtract(identity.id, candidateId).catch(() => {});
  await claimConversation(identity.id, candidateId).catch(() => {});
  await auditChannel("channel.link", candidateId, identity, { method });
}

// Re-attach the anonymous conversation to the candidate when their
// [candidateId, platform] slot is free; a unique violation means they already
// have a thread on that platform — the anonymous thread then simply stays
// keyed by channelIdentityId.
async function claimConversation(channelIdentityId: string, candidateId: string): Promise<void> {
  await prisma.conversation.updateMany({
    where: { channelIdentityId, candidateId: null },
    data: { candidateId },
  });
}

// Merge the anonymous-phase extraction onto the Candidate row — same
// semantics as the bridge's persistExtracted (scalars overwrite, arrays
// merge-dedupe, memory facts via persistMemoryFacts). Reserved `__` keys are
// skipped. After replay, only reserved keys are kept on pendingExtract.
async function replayPendingExtract(channelIdentityId: string, candidateId: string): Promise<void> {
  const row = await prisma.channelIdentity.findUnique({
    where: { id: channelIdentityId },
    select: { pendingExtract: true },
  });
  if (!row?.pendingExtract || typeof row.pendingExtract !== "object" || Array.isArray(row.pendingExtract)) {
    return;
  }
  const pe = row.pendingExtract as Record<string, unknown>;

  const data: Prisma.CandidateUpdateInput = {};
  if (typeof pe.firstName === "string" && pe.firstName.trim()) data.firstName = pe.firstName.trim().slice(0, 120);
  if (typeof pe.lastName === "string" && pe.lastName.trim()) data.lastName = pe.lastName.trim().slice(0, 120);
  if (typeof pe.city === "string" && pe.city.trim()) data.city = pe.city.trim().slice(0, 120);
  if (typeof pe.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}/.test(pe.dateOfBirth)) {
    const d = new Date(pe.dateOfBirth.slice(0, 10));
    if (!Number.isNaN(d.getTime())) data.dateOfBirth = d;
  }
  // Anonymous-phase levels are SELF-CLAIMED — clear the AI-verified stamp on
  // overwrite, same rule as the bridge's persistExtracted (only
  // /api/ai/lang-test may set langScore*VerifiedAt).
  if (typeof pe.langScoreFR === "number" && Number.isFinite(pe.langScoreFR)) {
    data.langScoreFR = clampInt(pe.langScoreFR, 0, 100);
    data.langScoreFRVerifiedAt = null;
  }
  if (typeof pe.langScoreEN === "number" && Number.isFinite(pe.langScoreEN)) {
    data.langScoreEN = clampInt(pe.langScoreEN, 0, 100);
    data.langScoreENVerifiedAt = null;
  }
  const skills = asStringArray(pe.skills);
  const sectors = asStringArray(pe.sectors);
  if (skills.length || sectors.length) {
    const existing = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { skills: true, sectors: true },
    });
    if (existing) {
      if (skills.length) data.skills = mergeUnique(existing.skills, skills);
      if (sectors.length) data.sectors = mergeUnique(existing.sectors, sectors);
    }
  }
  if (Object.keys(data).length > 0) {
    await prisma.candidate.update({ where: { id: candidateId }, data });
  }

  const memory = sanitiseMemoryFacts(pe.memory);
  if (Object.keys(memory).length > 0) {
    await persistMemoryFacts(candidateId, memory);
  }

  // Strip replayed extract keys; keep reserved state + a replay marker.
  const next: Record<string, unknown> = { __replayedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(pe)) {
    if (k.startsWith("__")) next[k] = v;
  }
  await prisma.channelIdentity.update({
    where: { id: channelIdentityId },
    data: { pendingExtract: next as Prisma.InputJsonValue },
  });
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

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 50)
    : [];
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Unlink (called by /api/me/channel-links DELETE after its ownership check)
// ---------------------------------------------------------------------------

export async function unlinkChannelIdentity(channelIdentityId: string): Promise<boolean> {
  const identity = await prisma.channelIdentity.findUnique({
    where: { id: channelIdentityId },
  });
  if (!identity || !identity.candidateId) return false;
  const candidateId = identity.candidateId;
  await prisma.channelIdentity.update({
    where: { id: channelIdentityId },
    data: { candidateId: null, status: "PENDING", linkedVia: null },
  });
  // Detach the claimed conversation from the channel: post-unlink anonymous
  // messages must not resume (or append to) the ex-candidate's transcript.
  // The thread stays with the candidate; the channel gets a fresh anonymous
  // thread on its next message. Best-effort — unlink itself must not fail.
  await prisma.conversation
    .updateMany({
      where: { channelIdentityId, candidateId: { not: null } },
      data: { channelIdentityId: null },
    })
    .catch(() => {});
  // Re-arm the over-cap notice: an over-cap ex-linked sender should get the
  // linkRequired message at least once instead of pure silence. The anonymous
  // turn counter itself is kept — linking stays required past ANON_TURNS_MAX.
  const reserved = readReserved(identity.pendingExtract);
  if (reserved.capNotice) {
    delete reserved.capNotice;
    await writeReserved(channelIdentityId, reserved).catch(() => {});
  }
  await auditChannel("channel.unlink", candidateId, identity, {});
  return true;
}

// ---------------------------------------------------------------------------
// Link-token issuing (used by /api/me/channel-links POST)
// ---------------------------------------------------------------------------

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  }
  return code;
}

export async function issueLinkToken(
  candidateId: string,
  platform?: SocialPlatform,
): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  // The code column is unique; retry a couple of times on the (vanishingly
  // unlikely) collision instead of failing the request.
  for (let attempt = 0; ; attempt++) {
    const code = generateLinkCode();
    try {
      await prisma.channelLinkToken.create({
        data: { code, candidateId, platform: platform ?? null, expiresAt },
      });
      return { code, expiresAt };
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 2) throw e;
    }
  }
}

// ---------------------------------------------------------------------------
// Webhook idempotency (WebhookEvent unique externalId gate)
// ---------------------------------------------------------------------------

// A duplicate whose first attempt never finished (processedAt still null) is
// re-claimable once it is old enough that the original lambda cannot still be
// running (webhook maxDuration is 60s) — otherwise a crash between the gate
// insert and processing would drop the message forever (at-most-once).
const STALE_UNPROCESSED_MS = 5 * 60_000;

// Returns true when this delivery is fresh (event recorded), false when the
// externalId was already seen (Meta retry → caller skips). Non-unique-
// violation failures return true: at-least-once processing beats dropping a
// user message because the gate hiccupped.
export async function recordWebhookEvent(
  platform: SocialPlatform,
  externalId: string,
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { platform, externalId } });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Atomic re-claim of a stale unprocessed row: bumping createdAt makes
      // exactly ONE retry win per staleness window (concurrent retries see a
      // fresh createdAt and stay deduped). Rows marked processed never match.
      const claimed = await prisma.webhookEvent
        .updateMany({
          where: {
            externalId,
            processedAt: null,
            createdAt: { lt: new Date(Date.now() - STALE_UNPROCESSED_MS) },
          },
          data: { createdAt: new Date() },
        })
        .catch(() => ({ count: 0 }));
      return claimed.count > 0;
    }
    return true;
  }
}

export async function markWebhookProcessed(externalId: string): Promise<void> {
  await prisma.webhookEvent
    .updateMany({ where: { externalId }, data: { processedAt: new Date() } })
    .catch(() => {
      /* best-effort */
    });
}

// Duck-typed P2002 check — survives mocked Prisma clients in tests.
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

// Phone matching is best-effort: Meta sends E.164 without the leading +; we
// tolerate either formatting on the Candidate row.
export async function findCandidateByPhone(senderId: string): Promise<string | null> {
  const digits = senderId.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const candidate = await prisma.candidate.findFirst({
    where: { OR: [{ phone: digits }, { phone: `+${digits}` }] },
    select: { id: true },
  });
  return candidate?.id ?? null;
}

export async function candidateLang(candidateId: string): Promise<Locale> {
  const row = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { user: { select: { lang: true } } },
  });
  return (row?.user.lang as Locale | undefined) ?? "FR";
}

async function auditChannel(
  action: "channel.link" | "channel.unlink",
  candidateId: string,
  identity: ChannelIdentity,
  metadata: Record<string, string>,
): Promise<void> {
  const cand = await prisma.candidate
    .findUnique({ where: { id: candidateId }, select: { userId: true } })
    .catch(() => null);
  if (!cand) return;
  await logAudit({
    userId: cand.userId,
    action,
    resourceType: "channel_identity",
    resourceId: identity.id,
    metadata: { platform: identity.platform, ...metadata },
  });
}
