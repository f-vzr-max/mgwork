import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { env } from "./config";

// Model policy: Haiku ("fast") is the default for every Claude call. Sonnet
// ("smart") is reachable ONLY through the *WithEscalation helpers below —
// callers must never request "smart" directly. No Opus tier.
export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
} as const;

export type ModelTier = keyof typeof MODELS;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Public params narrow `model` to the fast tier so the policy above is
// compiler-enforced: passing model:"smart" to chat()/extractFromImage() is a
// type error. The escalation helpers use the internal wide-tier functions.
export type ChatParams = {
  system: string;
  messages: ChatMessage[];
  model?: Extract<ModelTier, "fast">;
  maxTokens?: number;
  temperature?: number;
};

export type ChatResult =
  | { error: "no-key" }
  | { error: "api-error"; message: string }
  | { text: string; stopReason: string | null; usage: { input: number; output: number } };

export type ExtractParams = {
  base64: string;
  mimeType: string;
  prompt: string;
  model?: Extract<ModelTier, "fast">;
  maxTokens?: number;
};

export type ExtractResult =
  | { error: "no-key" }
  | { error: "api-error"; message: string }
  | { text: string; stopReason: string | null };

let cached: Anthropic | null | undefined;

function client(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = env.anthropicKey();
  cached = apiKey ? new Anthropic({ apiKey }) : null;
  return cached;
}

// Reset the cached client. Exposed for tests; internal use only.
export function _resetClaudeClient(): void {
  cached = undefined;
}

// Internal wide-tier variants — module-private so "smart" stays unreachable
// outside the escalation helpers.
type InternalChatParams = Omit<ChatParams, "model"> & { model?: ModelTier };
type InternalExtractParams = Omit<ExtractParams, "model"> & { model?: ModelTier };

export async function chat(params: ChatParams): Promise<ChatResult> {
  return chatWithTier(params);
}

async function chatWithTier(params: InternalChatParams): Promise<ChatResult> {
  const c = client();
  if (!c) return { error: "no-key" };
  const model = MODELS[params.model ?? "fast"];
  try {
    const res = await c.messages.create({
      model,
      system: params.system,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
    return {
      text,
      stopReason: res.stop_reason,
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  } catch (err) {
    return { error: "api-error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function extractFromImage(params: ExtractParams): Promise<ExtractResult> {
  return extractWithTier(params);
}

async function extractWithTier(params: InternalExtractParams): Promise<ExtractResult> {
  const c = client();
  if (!c) return { error: "no-key" };
  const model = MODELS[params.model ?? "fast"];
  const mediaType = normalizeImageMime(params.mimeType);
  if (!mediaType) {
    return {
      error: "api-error",
      message: `Unsupported image mime type: ${params.mimeType}`,
    };
  }
  try {
    const res = await c.messages.create({
      model,
      max_tokens: params.maxTokens ?? 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: params.base64 },
            },
            { type: "text", text: params.prompt },
          ],
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
    return { text, stopReason: res.stop_reason };
  } catch (err) {
    return { error: "api-error", message: err instanceof Error ? err.message : String(err) };
  }
}

export type ChatSuccess = Extract<ChatResult, { text: string }>;
export type ExtractSuccess = Extract<ExtractResult, { text: string }>;

// Escalation helpers — the ONLY sanctioned path to the smart tier.
//
// Each helper runs the call on "fast" (Haiku). If the result is an error,
// empty/whitespace text, or fails the caller's validate(), it retries ONCE on
// "smart" (Sonnet) and returns that result instead. The `escalated` flag says
// whether the smart retry ran (callers should surface it in audit metadata).
// A missing API key short-circuits — escalating cannot fix "no-key".

export async function chatWithEscalation(
  params: Omit<ChatParams, "model"> & { validate?: (r: ChatSuccess) => boolean },
): Promise<ChatResult & { escalated: boolean }> {
  const { validate, ...rest } = params;
  const fast = await chatWithTier({ ...rest, model: "fast" });
  if ("error" in fast && fast.error === "no-key") return { ...fast, escalated: false };
  const fastOk =
    !("error" in fast) && fast.text.trim().length > 0 && (!validate || validate(fast));
  if (fastOk) return { ...fast, escalated: false };
  const smart = await chatWithTier({ ...rest, model: "smart" });
  return { ...smart, escalated: true };
}

export async function extractWithEscalation(
  params: Omit<ExtractParams, "model"> & { validate?: (r: ExtractSuccess) => boolean },
): Promise<ExtractResult & { escalated: boolean }> {
  const { validate, ...rest } = params;
  const fast = await extractWithTier({ ...rest, model: "fast" });
  if ("error" in fast && fast.error === "no-key") return { ...fast, escalated: false };
  const fastOk =
    !("error" in fast) && fast.text.trim().length > 0 && (!validate || validate(fast));
  if (fastOk) return { ...fast, escalated: false };
  const smart = await extractWithTier({ ...rest, model: "smart" });
  return { ...smart, escalated: true };
}

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

function normalizeImageMime(mime: string): AllowedImageMime | null {
  const lower = mime.toLowerCase();
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(lower) ? (lower as AllowedImageMime) : null;
}

// ---------------------------------------------------------------------------
// PDF extraction — separate path; does NOT go through normalizeImageMime.
// Wired but inert until ANTHROPIC_API_KEY is set (no-key no-op).
// ---------------------------------------------------------------------------

export type PdfExtractParams = {
  base64: string;
  prompt: string;
  model?: Extract<ModelTier, "fast">;
  maxTokens?: number;
  validate?: (r: ExtractSuccess) => boolean;
};

type InternalPdfExtractParams = Omit<PdfExtractParams, "model"> & { model?: ModelTier };

async function extractPdfWithTier(params: InternalPdfExtractParams): Promise<ExtractResult> {
  const c = client();
  if (!c) return { error: "no-key" };
  const model = MODELS[params.model ?? "fast"];
  // DocumentBlockParam typed via SDK — no as-any needed.
  const docBlock: DocumentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: params.base64 },
  };
  try {
    const res = await c.messages.create({
      model,
      max_tokens: params.maxTokens ?? 2048,
      messages: [
        {
          role: "user",
          content: [docBlock, { type: "text", text: params.prompt }],
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
    return { text, stopReason: res.stop_reason };
  } catch (err) {
    return { error: "api-error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function extractFromPdf(params: PdfExtractParams): Promise<ExtractResult> {
  return extractPdfWithTier(params);
}

export async function extractPdfWithEscalation(
  params: Omit<PdfExtractParams, "model">,
): Promise<ExtractResult & { escalated: boolean }> {
  const { validate, ...rest } = params;
  const fast = await extractPdfWithTier({ ...rest, model: "fast" });
  if ("error" in fast && fast.error === "no-key") return { ...fast, escalated: false };
  const fastOk =
    !("error" in fast) && fast.text.trim().length > 0 && (!validate || validate(fast));
  if (fastOk) return { ...fast, escalated: false };
  const smart = await extractPdfWithTier({ ...rest, model: "smart" });
  return { ...smart, escalated: true };
}
