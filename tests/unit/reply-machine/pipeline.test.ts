// Tool-use loop — termination bound, ctx propagation, tool-error handling.
// Mock @/lib/claude (chatWithTools) before importing the pipeline. aidefence is
// left real (benign inputs pass).

const mockChatWithTools = jest.fn() as jest.Mock;

jest.mock("@/lib/claude", () => ({ chatWithTools: mockChatWithTools }));

import { runReply } from "@/lib/reply-machine/pipeline";
import type { RoutingModule, CallContext } from "@/lib/reply-machine/contract";

const TOOL: RoutingModule["listTools"] = () => [
  { name: "get_candidate_status", description: "d", access: "read", inputSchema: { type: "object", properties: {} } },
];

function fakeModule(overrides: Partial<RoutingModule> = {}): RoutingModule {
  return {
    manifest: () => ({ projectId: "mgwork", displayName: "x", contractVersion: "1.0.0", channels: [] }),
    retrieveContext: jest.fn().mockResolvedValue([]),
    listTools: TOOL,
    callTool: jest.fn().mockResolvedValue({ ok: true, data: { linked: false } }),
    policy: () => ({ systemPromptFragment: "sys", autoReply: {}, maxToolCallsPerReply: 2 }),
    ...overrides,
  };
}

const textResp = (text: string) => ({
  content: [{ type: "text", text }],
  stopReason: "end_turn",
  usage: { input: 1, output: 1 },
});
const toolResp = (id: string, name: string) => ({
  content: [{ type: "tool_use", id, name, input: {} }],
  stopReason: "tool_use",
  usage: { input: 1, output: 1 },
});

const ctx: CallContext = { projectId: "mgwork", channel: "web", candidateId: "cand-1" };

describe("runReply", () => {
  it("returns the text answer with no tools used", async () => {
    mockChatWithTools.mockResolvedValueOnce(textResp("bonjour"));
    const m = fakeModule();
    const r = await runReply({ ctx, module: m, incomingText: "salut" });
    expect(r).toMatchObject({ ok: true, reply: "bonjour", toolCalls: 0 });
    expect(m.callTool).not.toHaveBeenCalled();
  });

  it("executes one tool round with ctx, then returns the final text", async () => {
    mockChatWithTools
      .mockResolvedValueOnce(toolResp("t1", "get_candidate_status"))
      .mockResolvedValueOnce(textResp("Voici votre statut"));
    const callTool = jest.fn().mockResolvedValue({ ok: true, data: { linked: true, applications: [] } });
    const m = fakeModule({ callTool });
    const r = await runReply({ ctx, module: m, incomingText: "mon statut?" });
    expect(r).toMatchObject({ ok: true, reply: "Voici votre statut", toolCalls: 1 });
    expect(callTool).toHaveBeenCalledWith("get_candidate_status", {}, ctx);
  });

  it("terminates at maxToolCalls then forces a final no-tools turn", async () => {
    mockChatWithTools
      .mockResolvedValueOnce(toolResp("t1", "get_candidate_status"))
      .mockResolvedValueOnce(toolResp("t2", "get_candidate_status"))
      .mockResolvedValueOnce(textResp("final"));
    const callTool = jest.fn().mockResolvedValue({ ok: true, data: {} });
    const m = fakeModule({ callTool });
    const r = await runReply({ ctx, module: m, incomingText: "boucle" });
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(mockChatWithTools).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ ok: true, reply: "final", toolCalls: 2 });
    // The forced final turn must offer NO tools.
    expect(mockChatWithTools.mock.calls[2][0].tools).toBeUndefined();
  });

  it("surfaces a no-key error", async () => {
    mockChatWithTools.mockResolvedValueOnce({ error: "no-key" });
    const r = await runReply({ ctx, module: fakeModule(), incomingText: "salut" });
    expect(r).toMatchObject({ ok: false, error: "no-key" });
  });

  it("passes a tool error back as is_error and keeps going", async () => {
    mockChatWithTools
      .mockResolvedValueOnce(toolResp("t1", "get_job_offer"))
      .mockResolvedValueOnce(textResp("desole"));
    const callTool = jest.fn().mockResolvedValue({ ok: false, error: "offer not found" });
    const m = fakeModule({ callTool });
    const r = await runReply({ ctx, module: m, incomingText: "offre?" });
    expect(r).toMatchObject({ ok: true, reply: "desole", toolCalls: 1 });
    const secondMessages = mockChatWithTools.mock.calls[1][0].messages;
    const toolResultTurn = secondMessages.find(
      (msg: { role: string; content: unknown }) => msg.role === "user" && Array.isArray(msg.content),
    );
    expect(toolResultTurn.content[0].is_error).toBe(true);
  });

  it("injects retrieved help context into the system prompt", async () => {
    mockChatWithTools.mockResolvedValueOnce(textResp("ok"));
    const m = fakeModule({ retrieveContext: jest.fn().mockResolvedValue([{ text: "HELPDOC", score: 1 }]) });
    await runReply({ ctx, module: m, incomingText: "aide" });
    const sys = mockChatWithTools.mock.calls[0][0].system as string;
    expect(sys).toContain("sys");
    expect(sys).toContain("HELPDOC");
  });

  it("never returns an empty reply (text-less turn falls back)", async () => {
    mockChatWithTools.mockResolvedValueOnce({ content: [], stopReason: "end_turn", usage: { input: 1, output: 1 } });
    const r = await runReply({ ctx, module: fakeModule(), incomingText: "salut" });
    expect(r.ok).toBe(true);
    expect((r as { reply: string }).reply.length).toBeGreaterThan(0);
  });

  it("does not surface an empty reply when cut off mid tool_use (max_tokens), and skips the truncated tool", async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "t1", name: "get_candidate_status", input: {} }],
      stopReason: "max_tokens",
      usage: { input: 1, output: 1 },
    });
    const callTool = jest.fn().mockResolvedValue({ ok: true, data: {} });
    const m = fakeModule({ callTool });
    const r = await runReply({ ctx, module: m, incomingText: "statut?" });
    expect(r).toMatchObject({ ok: true, toolCalls: 0 });
    expect((r as { reply: string }).reply.length).toBeGreaterThan(0);
    expect(callTool).not.toHaveBeenCalled();
  });
});
