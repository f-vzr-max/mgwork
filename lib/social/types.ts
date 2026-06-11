// Social adapter contract.
//
// Two implementations live alongside this file:
//   - in-app-adapter.ts — DB-only, used by the SSE chat endpoint.
//   - meta-adapter.ts   — Meta Cloud API (WhatsApp/Messenger). Real-mode when
//                         env.metaAppSecret() && env.whatsappAccessToken() are
//                         present; otherwise every method is a no-op that
//                         returns `{ skipped: true }` so M6 builds and runs
//                         end-to-end without the human-gated Meta credentials.
//
// `LlmBridge` consumes the adapter through this interface so swapping to a
// live Meta integration is config-only.

import type { SocialPlatform } from "@prisma/client";

export type ChatRole = "user" | "assistant";

// Persisted shape of one history row inside Conversation.history (JSONB).
// Keep this small and append-only — old rows must remain readable as we evolve
// the schema, so always treat unknown fields as opaque.
export type ConversationMessage = {
  role: ChatRole;
  text: string;
  // ISO timestamp. We store the createdAt of the assistant or user turn so the
  // UI can render absolute timestamps without re-computing.
  at: string;
  // Optional provider-specific reference for outbound delivery tracking.
  externalId?: string;
};

// Inbound event normalised across providers. The adapter is responsible for
// translating provider-specific payloads into this shape.
export type IncomingMessage = {
  // SocialPlatform enum value — IN_APP, WHATSAPP, MESSENGER, etc.
  platform: SocialPlatform;
  // Provider's stable thread/conversation id (phone number id for WhatsApp,
  // PSID for Messenger, candidateId for IN_APP).
  threadId: string;
  // Provider's id for the inbound message (used for idempotency).
  externalId?: string;
  // Sender wallet — phone number (whatsapp), psid (messenger), candidateId
  // (in-app). This is what we look up to find the Candidate row.
  senderId: string;
  text: string;
  // Provider-supplied receive time when present, otherwise server now.
  receivedAt: Date;
  // Best-effort language hint from the provider; LLM bridge falls back to the
  // candidate's stored preference.
  langHint?: "FR" | "EN" | "MG";
  // Messenger/Instagram m.me referral ref (`m.me/<page>?ref=<code>`) — carries
  // a ChannelLinkToken code so identity linking works without typing "LINK".
  referralRef?: string;
};

// Outbound message we ask the adapter to deliver. `text` is already plaintext
// (HTML stripped, no markdown control chars) — the LLM bridge does sanitation.
export type OutgoingMessage = {
  threadId: string;
  text: string;
};

// Result of dispatching an outbound message.
export type SendResult =
  | { ok: true; externalId?: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

// Result of accepting / processing an inbound event before LLM dispatch.
export type ReceiveResult =
  | { ok: true; message: IncomingMessage }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

// Webhook signature verification result. `text` is the raw body string we
// received (so the route can pass it on to JSON.parse only after verification).
export type VerifyResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export interface SocialAdapter {
  readonly platform: SocialPlatform;

  // Verify a webhook request signature against the raw body BEFORE parsing.
  // Adapters that don't accept webhooks (in-app) should return ok with the
  // body text unchanged — the route layer is the gate for who can call which.
  verifyWebhook(req: Request): Promise<VerifyResult>;

  // Translate a verified provider payload into a normalised IncomingMessage.
  // Returns `skipped` for events we don't act on (status callbacks, read
  // receipts, etc.) — the caller treats those as 200 OK no-ops.
  receive(event: unknown): Promise<ReceiveResult>;

  // Optional batch variant: Meta delivers webhook batches (entry[] can carry
  // several messages); adapters that support it return EVERY actionable
  // message so none is dropped. `receive` stays as the single-message
  // interface for adapters that don't batch (in-app).
  receiveAll?(event: unknown): Promise<IncomingMessage[]>;

  // Deliver an outbound message. Real adapters POST to provider HTTP APIs;
  // stub mode returns `{ skipped: true }` so M6 stays buildable until the
  // human has set up Meta Business / WhatsApp tokens.
  send(threadId: string, text: string): Promise<SendResult>;
}
