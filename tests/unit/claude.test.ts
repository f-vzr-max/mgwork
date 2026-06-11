// Unit tests for lib/claude.ts — model policy + escalation helpers.
//
// The Anthropic SDK is mocked at the module boundary: `mockCreate` stands in
// for `client.messages.create`. Each test re-seeds ANTHROPIC_API_KEY and
// resets the cached client so key presence is re-evaluated per test.

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: mockCreate } })),
}));

import {
  MODELS,
  chat,
  chatWithEscalation,
  extractFromImage,
  extractWithEscalation,
  _resetClaudeClient,
} from "@/lib/claude";

function apiMessage(text: string) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

const CHAT_PARAMS = {
  system: "You are a test.",
  messages: [{ role: "user" as const, content: "hi" }],
};

const EXTRACT_PARAMS = {
  base64: "aGVsbG8=",
  mimeType: "image/png",
  prompt: "Extract things.",
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  _resetClaudeClient();
});

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("MODELS", () => {
  it("exposes exactly the fast and smart tiers (no reasoning/Opus)", () => {
    expect(Object.keys(MODELS).sort()).toEqual(["fast", "smart"]);
  });
});

describe("chat()", () => {
  it("defaults to the fast tier when no model is requested", async () => {
    mockCreate.mockResolvedValueOnce(apiMessage("hello"));
    const r = await chat(CHAT_PARAMS);
    expect("error" in r).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe(MODELS.fast);
  });
});

describe("extractFromImage()", () => {
  it("defaults to the fast tier when no model is requested", async () => {
    mockCreate.mockResolvedValueOnce(apiMessage("extracted"));
    const r = await extractFromImage(EXTRACT_PARAMS);
    expect("error" in r).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe(MODELS.fast);
  });
});

describe("chatWithEscalation()", () => {
  it("returns no-key without calling the API and without escalating", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    _resetClaudeClient();
    const r = await chatWithEscalation(CHAT_PARAMS);
    expect(r).toEqual({ error: "no-key", escalated: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stays on fast when the first call succeeds", async () => {
    mockCreate.mockResolvedValueOnce(apiMessage("fine answer"));
    const r = await chatWithEscalation(CHAT_PARAMS);
    expect(r.escalated).toBe(false);
    if ("error" in r) throw new Error("expected success");
    expect(r.text).toBe("fine answer");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe(MODELS.fast);
  });

  it("retries once on smart when the fast call errors", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("overloaded"))
      .mockResolvedValueOnce(apiMessage("smart answer"));
    const r = await chatWithEscalation(CHAT_PARAMS);
    expect(r.escalated).toBe(true);
    if ("error" in r) throw new Error("expected success");
    expect(r.text).toBe("smart answer");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe(MODELS.fast);
    expect(mockCreate.mock.calls[1][0].model).toBe(MODELS.smart);
  });

  it("retries once on smart when the fast text is empty/whitespace", async () => {
    mockCreate
      .mockResolvedValueOnce(apiMessage("   \n  "))
      .mockResolvedValueOnce(apiMessage("real answer"));
    const r = await chatWithEscalation(CHAT_PARAMS);
    expect(r.escalated).toBe(true);
    if ("error" in r) throw new Error("expected success");
    expect(r.text).toBe("real answer");
    expect(mockCreate.mock.calls[1][0].model).toBe(MODELS.smart);
  });

  it("retries once on smart when validate() rejects the fast result", async () => {
    mockCreate
      .mockResolvedValueOnce(apiMessage("no score here"))
      .mockResolvedValueOnce(apiMessage("<score>80</score>"));
    const r = await chatWithEscalation({
      ...CHAT_PARAMS,
      validate: (res) => /<score>\d+<\/score>/.test(res.text),
    });
    expect(r.escalated).toBe(true);
    if ("error" in r) throw new Error("expected success");
    expect(r.text).toBe("<score>80</score>");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not escalate when validate() accepts the fast result", async () => {
    mockCreate.mockResolvedValueOnce(apiMessage("<score>55</score>"));
    const r = await chatWithEscalation({
      ...CHAT_PARAMS,
      validate: (res) => /<score>\d+<\/score>/.test(res.text),
    });
    expect(r.escalated).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns the smart-tier failure when both tiers fail (no second retry)", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("fast down"))
      .mockRejectedValueOnce(new Error("smart down"));
    const r = await chatWithEscalation(CHAT_PARAMS);
    expect(r.escalated).toBe(true);
    if (!("error" in r)) throw new Error("expected error");
    expect(r.error).toBe("api-error");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe("extractWithEscalation()", () => {
  it("returns no-key without calling the API and without escalating", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    _resetClaudeClient();
    const r = await extractWithEscalation(EXTRACT_PARAMS);
    expect(r).toEqual({ error: "no-key", escalated: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stays on fast when the first call passes validate()", async () => {
    mockCreate.mockResolvedValueOnce(apiMessage('<extracted>{"skills":[]}</extracted>'));
    const r = await extractWithEscalation({
      ...EXTRACT_PARAMS,
      validate: (res) => /<extracted>/.test(res.text),
    });
    expect(r.escalated).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe(MODELS.fast);
  });

  it("retries once on smart when validate() rejects the fast result", async () => {
    mockCreate
      .mockResolvedValueOnce(apiMessage("not the block you wanted"))
      .mockResolvedValueOnce(apiMessage('<extracted>{"skills":[]}</extracted>'));
    const r = await extractWithEscalation({
      ...EXTRACT_PARAMS,
      validate: (res) => /<extracted>/.test(res.text),
    });
    expect(r.escalated).toBe(true);
    if ("error" in r) throw new Error("expected success");
    expect(r.text).toContain("<extracted>");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].model).toBe(MODELS.smart);
  });
});
