// Meta Cloud API webhook (WhatsApp / Messenger / Instagram).
//
// Per docs/contracts.md row "/api/webhooks/meta":
//   - GET: hub.mode=subscribe verification handshake. Echoes hub.challenge if
//     hub.verify_token matches env.metaWebhookVerifyToken().
//   - POST: HMAC-SHA256-verified event delivery. Body is normalised through
//     `metaAdapter.receive`, fed to `llmBridge.process`, and the assistant
//     reply is dispatched back via `metaAdapter.send`.
//
// Security:
//   - Webhooks NEVER call Clerk auth() — they're authenticated by signature.
//     `scripts/security-check.ts` exempts files under `app/api/webhooks/`.
//   - We MUST verify the HMAC against the raw body BEFORE parsing JSON.
//   - When env vars are absent the route returns 200 silently (per the
//     acceptance criteria) — we never 500 the human-gated stub mode.
//   - We DO write a webhook-specific audit row keyed on the first SUPER_ADMIN
//     User.id; if no super-admin exists yet, we skip the audit silently.

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { logAudit } from "@/lib/audit";
import { metaAdapter } from "@/lib/social/meta-adapter";
import { process as bridgeProcess } from "@/lib/social/llm-bridge";

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
// POST — verified event ingest
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // Stub mode: when neither HMAC secret nor verify token is configured we
  // accept the call, audit nothing sensitive, and return 200. This keeps
  // automated provider health checks happy without leaking schema info.
  if (!env.metaAppSecret() || !env.whatsappAccessToken()) {
    await tryAuditWebhookSkipped();
    return new Response(null, { status: 200 });
  }

  const verify = await metaAdapter.verifyWebhook(req);
  if (!verify.ok) {
    // Audit the rejected attempt — still safely so it never throws.
    await tryAuditWebhookRejected(verify.reason);
    return new Response("forbidden", { status: 403 });
  }

  // Body is a string we already read inside verifyWebhook; parse safely.
  let payload: unknown;
  try {
    payload = JSON.parse(verify.text);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const incoming = await metaAdapter.receive(payload);
  if ("skipped" in incoming) {
    return new Response(null, { status: 200 });
  }
  if (!incoming.ok) {
    return new Response(null, { status: 200 });
  }

  // Resolve the candidate from the sender. We match on phone number when the
  // WhatsApp `from` field is a digit-only string. If we can't resolve, we
  // 200 silently — Meta will not retry endlessly and we avoid leaking the
  // existence of a candidate.
  const candidateId = await resolveCandidateBySender(incoming.message.senderId);
  if (!candidateId) {
    await tryAuditWebhookEvent(incoming.message.senderId, "candidate-not-resolved");
    return new Response(null, { status: 200 });
  }

  const lang = await resolveLangForCandidate(candidateId);

  // The bridge `process` may throw AIDefenceError on hostile inputs; catch and
  // return 200 (never 500) so Meta doesn't replay the malicious payload.
  let bridgeResult;
  try {
    bridgeResult = await bridgeProcess({
      candidateId,
      incomingText: incoming.message.text,
      lang,
    });
  } catch {
    await tryAuditWebhookEvent(incoming.message.senderId, "bridge-rejected");
    return new Response(null, { status: 200 });
  }

  if (!bridgeResult.ok) {
    await tryAuditWebhookEvent(incoming.message.senderId, `bridge-error:${bridgeResult.error}`);
    return new Response(null, { status: 200 });
  }

  // Send the assistant reply back through the adapter.
  await metaAdapter.send(incoming.message.senderId, bridgeResult.reply);

  await tryAuditWebhookEvent(incoming.message.senderId, "ok");
  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveCandidateBySender(senderId: string): Promise<string | null> {
  const digits = senderId.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // Phone matching is best-effort: Meta sends E.164 without leading +. We
  // tolerate either formatting.
  const candidate = await prisma.candidate.findFirst({
    where: {
      OR: [{ phone: digits }, { phone: `+${digits}` }],
    },
    select: { id: true },
  });
  return candidate?.id ?? null;
}

async function resolveLangForCandidate(candidateId: string): Promise<"FR" | "EN" | "MG"> {
  const row = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { user: { select: { lang: true } } },
  });
  return (row?.user.lang as "FR" | "EN" | "MG" | undefined) ?? "FR";
}

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
