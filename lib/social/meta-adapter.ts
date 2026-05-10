// Meta Cloud API social adapter (WhatsApp Business + Messenger).
//
// Behaviour:
//   - Real-mode: env.metaAppSecret() && env.whatsappAccessToken() both present.
//     `verifyWebhook` enforces HMAC-SHA256 against the raw body, `receive`
//     normalises the event, and `send` POSTs to the Cloud API.
//   - Stub-mode: any required env var missing. `verifyWebhook` rejects (so the
//     route can return 200 without parsing untrusted bodies), `send` returns
//     `{ skipped: true }`. `receive` still works on already-verified payloads
//     so unit tests against fixtures stay possible.
//
// Spec references:
//   - WhatsApp Cloud API webhook payload: graph.facebook.com docs §webhook.
//   - Signature header: `X-Hub-Signature-256: sha256=<hex>`.

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config";
import { metaWebhookEventSchema } from "../validation/webhook-meta";
import type {
  IncomingMessage,
  ReceiveResult,
  SendResult,
  SocialAdapter,
  VerifyResult,
} from "./types";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

export class MetaAdapter implements SocialAdapter {
  readonly platform = "WHATSAPP" as const;

  // Real-mode iff BOTH the app secret (for HMAC) and an access token (for
  // outbound) are configured.
  private isLive(): boolean {
    return Boolean(env.metaAppSecret()) && Boolean(env.whatsappAccessToken());
  }

  async verifyWebhook(req: Request): Promise<VerifyResult> {
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
    // once — the route MUST call verifyWebhook before any other parse step.
    const raw = await req.text();
    const computedHex = createHmac("sha256", secret).update(raw).digest("hex");

    const a = Buffer.from(providedHex, "hex");
    const b = Buffer.from(computedHex, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "meta: signature mismatch" };
    }
    return { ok: true, text: raw };
  }

  async receive(event: unknown): Promise<ReceiveResult> {
    const parsed = metaWebhookEventSchema.safeParse(event);
    if (!parsed.success) {
      return { ok: false, error: "meta receive: payload failed schema" };
    }
    const root = parsed.data;
    // Only act on WhatsApp Business / Messaging product events that carry a
    // user-authored text message. Everything else (statuses, reactions,
    // unsupported message types) is silently skipped.
    for (const entry of root.entry) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const messages = value.messages;
        if (!messages?.length) continue;
        for (const m of messages) {
          if (m.type !== "text") continue;
          const body = m.text?.body;
          if (typeof body !== "string" || body.length === 0) continue;
          const phoneNumberId = value.metadata?.phone_number_id ?? entry.id;
          const incoming: IncomingMessage = {
            platform: "WHATSAPP",
            threadId: phoneNumberId,
            externalId: m.id,
            senderId: m.from,
            text: body,
            receivedAt: new Date(),
          };
          return { ok: true, message: incoming };
        }
      }
    }
    return { skipped: true, reason: "meta: no actionable text message" };
  }

  async send(threadId: string, text: string): Promise<SendResult> {
    if (!this.isLive()) {
      return { skipped: true, reason: "meta: live credentials missing" };
    }
    const accessToken = env.whatsappAccessToken();
    const phoneId = env.whatsappPhoneNumberId();
    if (!accessToken || !phoneId) {
      return { skipped: true, reason: "meta: phone id or token missing" };
    }
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(phoneId)}/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: threadId,
          type: "text",
          text: { body: text },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          ok: false,
          error: `meta: HTTP ${res.status} ${detail.slice(0, 120)}`,
        };
      }
      const json = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
      };
      const externalId = json.messages?.[0]?.id;
      return { ok: true, externalId };
    } catch (e) {
      return {
        ok: false,
        error: `meta: network error ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}

export const metaAdapter = new MetaAdapter();
