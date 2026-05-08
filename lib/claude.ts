import Anthropic from "@anthropic-ai/sdk";
import { env } from "./config";

export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
  reasoning: "claude-opus-4-7",
} as const;

export type ModelTier = keyof typeof MODELS;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatParams = {
  system: string;
  messages: ChatMessage[];
  model?: ModelTier;
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
  model?: ModelTier;
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

export async function chat(params: ChatParams): Promise<ChatResult> {
  const c = client();
  if (!c) return { error: "no-key" };
  const model = MODELS[params.model ?? "smart"];
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
  const c = client();
  if (!c) return { error: "no-key" };
  const model = MODELS[params.model ?? "smart"];
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

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

function normalizeImageMime(mime: string): AllowedImageMime | null {
  const lower = mime.toLowerCase();
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(lower) ? (lower as AllowedImageMime) : null;
}
