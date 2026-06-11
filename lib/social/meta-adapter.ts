// Meta Cloud API social adapters (WhatsApp Business + Messenger + Instagram).
//
// One Meta app feeds a single webhook endpoint with several products; the
// payload `object` field tells them apart:
//   - "whatsapp_business_account" → entry[].changes[].value.messages[]
//   - "page"                      → entry[].messaging[]   (Messenger)
//   - "instagram"                 → entry[].messaging[]   (Instagram DMs)
// `metaAdapterFor(object)` dispatches to the right per-product adapter; all
// implement the shared SocialAdapter interface so the webhook route stays
// product-agnostic.
//
// Behaviour:
//   - Signature: `verifyMetaWebhook` enforces HMAC-SHA256 against the raw body
//     with env.metaAppSecret(); shared by every product (one Meta app secret).
//   - Outbound: each product needs its own credential — WhatsApp Cloud API
//     token + phone-number id vs page access token for /me/messages. A missing
//     credential degrades that adapter's `send` to `{ skipped: true }` so the
//     human-gated stub mode is preserved per product.
//   - `receive`/`receiveAll` work on already-verified payloads without env so
//     unit tests against fixtures stay possible.
//
// Spec references:
//   - WhatsApp Cloud API webhook payload: graph.facebook.com docs §webhook.
//   - Messenger Platform webhook events: messaging[], message.mid/text,
//     referral.ref (m.me links), message.is_echo (page-authored → skip).
//   - Signature header: `X-Hub-Signature-256: sha256=<hex>`.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SocialPlatform } from "@prisma/client";
import { env } from "../config";
import {
  metaWebhookEventSchema,
  messengerMessagingItemSchema,
} from "../validation/webhook-meta";
import type {
  IncomingMessage,
  ReceiveResult,
  SendResult,
  SocialAdapter,
  VerifyResult,
} from "./types";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

// ---------------------------------------------------------------------------
// Shared HMAC verification (one app secret covers every Meta product)
// ---------------------------------------------------------------------------

export async function verifyMetaWebhook(req: Request): Promise<VerifyResult> {
  const secret = env.metaAppSecret();
  if (!secret) {
    return { ok: false, reason: "meta: app secret missing (stub mode)" };
  }
  const sigHeader = req.headers.get("x-hub-signature-256");
  if (!sigHeader) {
    return { ok: false, reason: "meta: missing X-Hub-Signature-256 header" };
  }
  // Header form: `sha256=<hex>`. Reject anything else.
  const match = /^sha256=([a-f0-9]{64})$/i.exec(sigHeader);
  if (!match) {
    return { ok: false, reason: "meta: malformed signature header" };
  }
  const providedHex = match[1].toLowerCase();

  // Read the raw body. Note: Next 14 Web Request bodies can only be read
  // once — the route MUST call verifyMetaWebhook before any other parse step.
  const raw = await req.text();
  const computedHex = createHmac("sha256", secret).update(raw).digest("hex");

  const a = Buffer.from(providedHex, "hex");
  const b = Buffer.from(computedHex, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "meta: signature mismatch" };
  }
  return { ok: true, text: raw };
}

// ---------------------------------------------------------------------------
// WhatsApp Business (object: "whatsapp_business_account")
// ---------------------------------------------------------------------------

export class WhatsAppAdapter implements SocialAdapter {
  readonly platform = "WHATSAPP" as const;

  // Real-mode iff BOTH the app secret (for HMAC) and an access token (for
  // outbound) are configured.
  private isLive(): boolean {
    return Boolean(env.metaAppSecret()) && Boolean(env.whatsappAccessToken());
  }

  async verifyWebhook(req: Request): Promise<VerifyResult> {
    return verifyMetaWebhook(req);
  }

  async receive(event: unknown): Promise<ReceiveResult> {
    const all = await this.receiveAll(event);
    if (all.length === 0) {
      return { skipped: true, reason: "whatsapp: no actionable text message" };
    }
    return { ok: true, message: all[0] };
  }

  // Every user-authored text message in the batch. Statuses, reactions and
  // unsupported message types are silently skipped.
  async receiveAll(event: unknown): Promise<IncomingMessage[]> {
    const parsed = metaWebhookEventSchema.safeParse(event);
    if (!parsed.success) return [];
    const out: IncomingMessage[] = [];
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const m of value.messages ?? []) {
          if (m.type !== "text") continue;
          const body = m.text?.body;
          if (typeof body !== "string" || body.length === 0) continue;
          const phoneNumberId = value.metadata?.phone_number_id ?? entry.id;
          out.push({
            platform: "WHATSAPP",
            threadId: phoneNumberId,
            externalId: m.id,
            senderId: m.from,
            text: body,
            receivedAt: new Date(),
          });
        }
      }
    }
    return out;
  }

  // WhatsApp Cloud API outbound: POST /<PHONE_ID>/messages, `to` is the user's
  // phone number (the inbound `senderId`).
  async send(threadId: string, text: string): Promise<SendResult> {
    if (!this.isLive()) {
      return { skipped: true, reason: "whatsapp: live credentials missing" };
    }
    const accessToken = env.whatsappAccessToken();
    const phoneId = env.whatsappPhoneNumberId();
    if (!accessToken || !phoneId) {
      return { skipped: true, reason: "whatsapp: phone id or token missing" };
    }
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(phoneId)}/messages`;
    return postGraph(url, { authorization: `Bearer ${accessToken}` }, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: threadId,
      type: "text",
      text: { body: text },
    });
  }
}

// ---------------------------------------------------------------------------
// Messenger / Instagram (object: "page" | "instagram")
// ---------------------------------------------------------------------------

export class MessengerAdapter implements SocialAdapter {
  readonly platform: SocialPlatform;

  constructor(platform: "MESSENGER" | "INSTAGRAM") {
    this.platform = platform;
  }

  async verifyWebhook(req: Request): Promise<VerifyResult> {
    return verifyMetaWebhook(req);
  }

  async receive(event: unknown): Promise<ReceiveResult> {
    const all = await this.receiveAll(event);
    if (all.length === 0) {
      return { skipped: true, reason: `${this.platform.toLowerCase()}: no actionable message` };
    }
    return { ok: true, message: all[0] };
  }

  // Every user-authored text message and m.me referral in the batch. Items are
  // validated one by one so a malformed sibling never sinks the whole batch.
  // Echo events (page-authored) and delivery/read callbacks are skipped. A
  // referral WITHOUT text (m.me link tap) still yields a message with empty
  // text + `referralRef` so identity linking can redeem the code.
  async receiveAll(event: unknown): Promise<IncomingMessage[]> {
    const parsed = metaWebhookEventSchema.safeParse(event);
    if (!parsed.success) return [];
    const out: IncomingMessage[] = [];
    for (const entry of parsed.data.entry) {
      for (const rawItem of entry.messaging ?? []) {
        const item = messengerMessagingItemSchema.safeParse(rawItem);
        if (!item.success) continue;
        const m = item.data;
        if (m.message?.is_echo) continue;
        const text = typeof m.message?.text === "string" ? m.message.text : "";
        const referralRef = m.referral?.ref ?? m.postback?.referral?.ref;
        if (text.length === 0 && !referralRef) continue;
        out.push({
          platform: this.platform,
          threadId: m.recipient?.id ?? entry.id,
          // mid is absent on pure referral events — synthesize a stable id so
          // the WebhookEvent idempotency gate still de-dupes retries. When
          // Meta also omits the timestamp, fall back to a per-event value: a
          // constant (`:0`) would permanently swallow every LATER referral
          // tap from the same sender; double-processing one retried tap is
          // the lesser failure (a used code just replies linkInvalid).
          externalId:
            m.message?.mid ?? `ref:${entry.id}:${m.sender.id}:${m.timestamp ?? Date.now()}`,
          senderId: m.sender.id,
          text,
          receivedAt: new Date(),
          ...(referralRef ? { referralRef } : {}),
        });
      }
    }
    return out;
  }

  // Messenger Platform outbound: POST /me/messages with the page access token;
  // `recipient.id` is the user's PSID (the inbound `senderId`). Instagram DMs
  // ride the same endpoint via the Messenger Platform.
  async send(threadId: string, text: string): Promise<SendResult> {
    const pageToken = env.metaPageAccessToken();
    if (!env.metaAppSecret() || !pageToken) {
      return { skipped: true, reason: `${this.platform.toLowerCase()}: live credentials missing` };
    }
    // Token rides in the Authorization header (same as the WhatsApp adapter):
    // query-string secrets leak into access/proxy/APM logs.
    const url = `${META_GRAPH_BASE}/me/messages`;
    return postGraph(url, { authorization: `Bearer ${pageToken}` }, {
      recipient: { id: threadId },
      messaging_type: "RESPONSE",
      message: { text },
    });
  }
}

// ---------------------------------------------------------------------------
// Shared outbound POST + dispatch
// ---------------------------------------------------------------------------

async function postGraph(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `meta: HTTP ${res.status} ${detail.slice(0, 120)}` };
    }
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      message_id?: string;
    };
    const externalId = json.messages?.[0]?.id ?? json.message_id;
    return { ok: true, externalId };
  } catch (e) {
    return {
      ok: false,
      error: `meta: network error ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
export const messengerAdapter = new MessengerAdapter("MESSENGER");
export const instagramAdapter = new MessengerAdapter("INSTAGRAM");

// Dispatch on the webhook payload's `object` field. Unknown products → null
// (the route acks 200 so Meta doesn't retry what we'll never handle).
export function metaAdapterFor(objectField: string): SocialAdapter | null {
  switch (objectField) {
    case "whatsapp_business_account":
      return whatsappAdapter;
    case "page":
      return messengerAdapter;
    case "instagram":
      return instagramAdapter;
    default:
      return null;
  }
}

// Outbound dispatch by normalised platform (for replies to IncomingMessages).
export function adapterForPlatform(platform: SocialPlatform): SocialAdapter | null {
  switch (platform) {
    case "WHATSAPP":
      return whatsappAdapter;
    case "MESSENGER":
      return messengerAdapter;
    case "INSTAGRAM":
      return instagramAdapter;
    default:
      return null;
  }
}
