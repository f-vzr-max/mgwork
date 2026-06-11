// Meta Cloud API webhook (WhatsApp / Messenger / Instagram).
//
// Per docs/contracts.md row "/api/webhooks/meta", hardened (channels phase 0):
//   - GET: hub.mode=subscribe verification handshake. Echoes hub.challenge if
//     hub.verify_token matches env.metaWebhookVerifyToken().
//   - POST: verify X-Hub-Signature-256 HMAC on the RAW body → parse →
//     dispatch on the payload `object` field to the per-product normaliser
//     (whatsapp_business_account vs page/instagram) → WebhookEvent idempotency
//     gate (unique externalId insert; duplicates skipped) → ACK 200
//     IMMEDIATELY → continue identity/bridge/reply processing in the
//     background via waitUntil(). Meta retries deliveries that respond
//     slowly; processing Claude calls inline before the ack caused retry
//     storms and duplicate replies.
//
// Security:
//   - Webhooks NEVER call Clerk auth() — they're authenticated by signature.
//     `scripts/security-check.ts` exempts files under `app/api/webhooks/`.
//   - We MUST verify the HMAC against the raw body BEFORE parsing JSON.
//   - When env vars are absent the route returns 200 silently (per the
//     acceptance criteria) — we never 500 the human-gated stub mode.
//   - We DO write a webhook-specific audit row keyed on the first SUPER_ADMIN
//     User.id; if no super-admin exists yet, we skip the audit silently.

import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { logAudit } from "@/lib/audit";
import {
  adapterForPlatform,
  metaAdapterFor,
  verifyMetaWebhook,
} from "@/lib/social/meta-adapter";
import {
  handleInbound,
  markWebhookProcessed,
  recordWebhookEvent,
} from "@/lib/social/identity";
import { process as bridgeProcess } from "@/lib/social/llm-bridge";
import type { IncomingMessage } from "@/lib/social/types";

// Background continuation (LLM call + outbound send) keeps the lambda alive
// past the 200 ack — give it headroom beyond the default 10s.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET — verify token handshake
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = env.metaWebhookVerifyToken();
  // Stub mode: no verify token configured. Do not 500 — return 200 silently
  // so health checks keep working.
  if (!expected) {
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response("forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — verified event ingest (ack fast, process in the background)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // Stub mode: without the app secret we cannot verify the HMAC. Accept the
  // call, audit nothing sensitive, and return 200 so automated provider
  // health checks stay happy without leaking schema info. (Outbound tokens
  // are checked per adapter — a page-only deploy still verifies here.)
  if (!env.metaAppSecret()) {
    await tryAuditWebhookSkipped();
    return new Response(null, { status: 200 });
  }

  const verify = await verifyMetaWebhook(req);
  if (!verify.ok) {
    // Audit the rejected attempt — still safely so it never throws.
    await tryAuditWebhookRejected(verify.reason);
    return new Response("forbidden", { status: 403 });
  }

  // Body is a string we already read inside verifyMetaWebhook; parse safely.
  let payload: unknown;
  try {
    payload = JSON.parse(verify.text);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Multi-product dispatch on the `object` field. Unknown products are acked
  // (Meta must not retry what we will never handle).
  const objectField =
    payload && typeof payload === "object" ? (payload as { object?: unknown }).object : undefined;
  const adapter = metaAdapterFor(typeof objectField === "string" ? objectField : "");
  if (!adapter?.receiveAll) {
    return new Response(null, { status: 200 });
  }

  const messages = await adapter.receiveAll(payload);
  if (messages.length === 0) {
    return new Response(null, { status: 200 });
  }

  // Idempotency gate BEFORE the ack: Meta retries while a slow first attempt
  // is still in flight; the unique WebhookEvent insert turns the second
  // delivery into a no-op instead of a duplicate reply.
  const fresh: IncomingMessage[] = [];
  for (const m of messages) {
    if (!m.externalId) {
      fresh.push(m);
      continue;
    }
    if (await recordWebhookEvent(m.platform, m.externalId)) fresh.push(m);
  }
  if (fresh.length === 0) {
    return new Response(null, { status: 200 });
  }

  // 200 now; identity + LLM + outbound reply continue in the background.
  // waitUntil keeps the lambda alive on Vercel; the catch covers runtimes
  // without a request context (local jest/node) by detaching the promise.
  const work = processMessages(fresh);
  try {
    waitUntil(work);
  } catch {
    void work.catch(() => {});
  }
  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Background processing
// ---------------------------------------------------------------------------

async function processMessages(messages: IncomingMessage[]): Promise<void> {
  for (const msg of messages) {
    try {
      await processOne(msg);
      // Mark processed ONLY on success: a throw leaves processedAt null so a
      // later Meta retry can re-claim the stale WebhookEvent row and
      // reprocess (see recordWebhookEvent) instead of dropping the message.
      if (msg.externalId) await markWebhookProcessed(msg.externalId);
    } catch {
      await tryAuditWebhookEvent(msg.senderId, "process-error");
    }
  }
}

async function processOne(msg: IncomingMessage): Promise<void> {
  // Identity layer decides: canned reply (linking, rate caps), bridge to the
  // LLM (linked candidate or anonymous channel identity), or silence.
  const action = await handleInbound(msg);

  if (action.kind === "silent") {
    await tryAuditWebhookEvent(msg.senderId, `silent:${action.reason}`);
    return;
  }
  if (action.kind === "reply") {
    await sendReply(msg, action.text);
    await tryAuditWebhookEvent(msg.senderId, "canned-reply");
    return;
  }

  // The bridge `process` may throw AIDefenceError on hostile inputs; catch and
  // stay silent (never 500) so Meta doesn't see anything to replay.
  let bridgeResult;
  try {
    bridgeResult = await bridgeProcess({
      candidateId: action.candidateId,
      channelIdentityId: action.channelIdentityId,
      incomingText: msg.text,
      lang: action.lang,
      platform: msg.platform,
      // Model policy: webhook channels are high-volume — hard-pin the fast
      // tier (Haiku, no smart retry).
      modelTier: "fast",
    });
  } catch {
    await tryAuditWebhookEvent(msg.senderId, "bridge-rejected");
    return;
  }

  if (!bridgeResult.ok) {
    await tryAuditWebhookEvent(msg.senderId, `bridge-error:${bridgeResult.error}`);
    return;
  }

  await sendReply(msg, bridgeResult.reply);
  await tryAuditWebhookEvent(msg.senderId, "ok");
}

// Outbound goes back through the platform the message arrived on; the
// recipient is the inbound senderId (phone number for WhatsApp, PSID for
// Messenger/Instagram).
async function sendReply(msg: IncomingMessage, text: string): Promise<void> {
  const adapter = adapterForPlatform(msg.platform);
  if (!adapter) return;
  await adapter.send(msg.senderId, text);
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

// Find the first SUPER_ADMIN user id for audit attribution. Returns null when
// none exists — the spec allows skipping the audit row in that case.
async function getAuditUserId(): Promise<string | null> {
  const sa = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return sa?.id ?? null;
}

async function tryAuditWebhookSkipped(): Promise<void> {
  const userId = await getAuditUserId().catch(() => null);
  if (!userId) return;
  await logAudit({
    userId,
    action: "webhook.meta_event",
    resourceType: "webhook",
    metadata: { result: "stub-skipped" },
  });
}

async function tryAuditWebhookRejected(reason: string): Promise<void> {
  const userId = await getAuditUserId().catch(() => null);
  if (!userId) return;
  await logAudit({
    userId,
    action: "webhook.meta_event",
    resourceType: "webhook",
    metadata: { result: "rejected", reason: reason.slice(0, 200) },
  });
}

async function tryAuditWebhookEvent(senderId: string, status: string): Promise<void> {
  const userId = await getAuditUserId().catch(() => null);
  if (!userId) return;
  // Hash the sender id so we don't dump full phone numbers into audit JSON.
  const masked = `${senderId.slice(0, 3)}***${senderId.slice(-2)}`;
  await logAudit({
    userId,
    action: "webhook.meta_event",
    resourceType: "webhook",
    metadata: { result: status, sender: masked },
  });
}
