// Native reply pipeline — turns one inbound message into one assistant reply,
// letting the model call the routing module's READ-ONLY tools in a bounded
// loop. Stateless (no conversation persistence): the stateful candidate
// onboarding chat lives in lib/social/llm-bridge. Reuses lib/claude for the
// model (Haiku-only by policy) — this path never touches the live bridge.

import { chatWithTools } from "../claude";
import { assertSafeForLLM } from "../aidefence";
import type { CallContext, RoutingModule, ToolSpec } from "./contract";
import type {
  MessageParam,
  Tool,
  ToolUseBlock,
  ToolResultBlockParam,
  ContentBlock,
} from "@anthropic-ai/sdk/resources/messages";

const DEFAULT_MAX_TOOL_CALLS = 4;

// A model turn can end with no text block — only a tool_use block truncated by
// max_tokens, or an empty forced-final turn — which makes finalText() "". Never
// surface an empty reply to the client (blank chat bubble).
const FALLBACK_REPLY =
  "Desole, je n'ai pas pu formuler de reponse. Reformulez votre question, s'il vous plait.";

export type ReplyResult =
  | { ok: true; reply: string; toolCalls: number }
  | { ok: false; error: "no-key" | "api-error"; message?: string };

function toAnthropicTools(specs: ToolSpec[]): Tool[] {
  return specs.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.inputSchema as Tool["input_schema"],
  }));
}

function finalText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runReply(params: {
  ctx: CallContext;
  module: RoutingModule;
  incomingText: string;
}): Promise<ReplyResult> {
  // Throws AIDefenceError on unsafe input — the route catches it and returns 400.
  assertSafeForLLM(params.incomingText);

  const policy = params.module.policy();
  const maxToolCalls = policy.maxToolCallsPerReply ?? DEFAULT_MAX_TOOL_CALLS;
  const context = await params.module.retrieveContext(params.incomingText, { topK: 4 });
  const contextBlock = context.length
    ? `\n\nRelevant help content (use it when applicable):\n${context
        .map((c) => `- ${c.text}`)
        .join("\n")}`
    : "";
  const system = `${policy.systemPromptFragment}${contextBlock}`;
  const tools = toAnthropicTools(params.module.listTools());

  const messages: MessageParam[] = [{ role: "user", content: params.incomingText }];
  let toolCalls = 0;

  // Bounded: at most maxToolCalls tool rounds, then one forced text turn.
  while (toolCalls < maxToolCalls) {
    const res = await chatWithTools({ system, messages, tools, maxTokens: 1024 });
    if ("error" in res) {
      return { ok: false, error: res.error, message: "message" in res ? res.message : undefined };
    }
    const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (res.stopReason !== "tool_use" || toolUses.length === 0) {
      return { ok: true, reply: finalText(res.content) || FALLBACK_REPLY, toolCalls };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      toolCalls++;
      const out = await params.module.callTool(
        tu.name,
        (tu.input ?? {}) as Record<string, unknown>,
        params.ctx,
      );
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(out),
        is_error: !out.ok,
      });
    }
    messages.push({ role: "user", content: results });
  }

  // Tool budget exhausted — force a final answer with NO tools offered.
  const final = await chatWithTools({ system, messages, maxTokens: 1024 });
  if ("error" in final) {
    return { ok: false, error: final.error, message: "message" in final ? final.message : undefined };
  }
  return { ok: true, reply: finalText(final.content) || FALLBACK_REPLY, toolCalls };
}
