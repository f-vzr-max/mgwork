// In-app social adapter.
//
// Used by `app/api/chat/route.ts` for the candidate-side SSE chat.
// There is no external transport here — the adapter exists so the LLM bridge
// can stay platform-agnostic. `verifyWebhook` is meaningless for in-app and
// returns `{ ok: false, reason: ... }` — the chat route never calls it.

import type {
  IncomingMessage,
  ReceiveResult,
  SendResult,
  SocialAdapter,
  VerifyResult,
} from "./types";

export class InAppAdapter implements SocialAdapter {
  readonly platform = "IN_APP" as const;

  async verifyWebhook(): Promise<VerifyResult> {
    return { ok: false, reason: "in-app adapter has no webhook" };
  }

  // For IN_APP, the caller already holds the parsed `IncomingMessage` (built
  // from the Clerk-authenticated chat POST body), so this method just echoes
  // the validated shape through. We accept `unknown` per the interface and
  // narrow defensively.
  async receive(event: unknown): Promise<ReceiveResult> {
    if (!isIncomingMessage(event)) {
      return { ok: false, error: "in-app receive: invalid IncomingMessage" };
    }
    if (event.platform !== "IN_APP") {
      return { ok: false, error: "in-app receive: wrong platform" };
    }
    return { ok: true, message: event };
  }

  // No outbound transport; the SSE response stream is how the assistant reply
  // reaches the client. We return `skipped` so the bridge can log it cleanly.
  async send(): Promise<SendResult> {
    return { skipped: true, reason: "in-app delivery happens via SSE stream" };
  }
}

export const inAppAdapter = new InAppAdapter();

function isIncomingMessage(v: unknown): v is IncomingMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.platform === "string" &&
    typeof m.threadId === "string" &&
    typeof m.senderId === "string" &&
    typeof m.text === "string" &&
    m.receivedAt instanceof Date
  );
}
