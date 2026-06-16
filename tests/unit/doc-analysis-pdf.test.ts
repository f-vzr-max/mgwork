// Unit tests for the PDF extraction path in lib/claude.ts.
//
// Asserts: (1) no-key short-circuit when ANTHROPIC_API_KEY is absent;
//          (2) a document block (not image) is built when the key is present.

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: mockCreate } })),
}));

import { extractFromPdf, extractPdfWithEscalation, _resetClaudeClient } from "@/lib/claude";

const PDF_BASE64 = "AAAA"; // minimal placeholder
const PROMPT = "Classify this PDF.";

beforeEach(() => {
  mockCreate.mockReset();
  _resetClaudeClient();
});

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("extractFromPdf() — no-key short-circuit", () => {
  it("returns { error: 'no-key' } when ANTHROPIC_API_KEY is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    _resetClaudeClient();
    const r = await extractFromPdf({ base64: PDF_BASE64, prompt: PROMPT });
    expect(r).toEqual({ error: "no-key" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("extractFromPdf() — document block shape when keyed", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    _resetClaudeClient();
  });

  it("builds a document block (type='document', source.media_type='application/pdf')", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "<analysis>{}</analysis>" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    await extractFromPdf({ base64: PDF_BASE64, prompt: PROMPT });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [callArg] = mockCreate.mock.calls[0];
    const userContent = callArg.messages[0].content as Array<{ type: string; source?: { type: string; media_type: string } }>;
    const docBlock = userContent.find((b) => b.type === "document");
    expect(docBlock).toBeDefined();
    expect(docBlock!.source?.type).toBe("base64");
    expect(docBlock!.source?.media_type).toBe("application/pdf");
    // No image block — PDFs must NOT go through the image path.
    expect(userContent.find((b) => b.type === "image")).toBeUndefined();
  });
});

describe("extractPdfWithEscalation() — no-key short-circuit", () => {
  it("returns { error: 'no-key', escalated: false } without calling the API", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    _resetClaudeClient();
    const r = await extractPdfWithEscalation({ base64: PDF_BASE64, prompt: PROMPT });
    expect(r).toEqual({ error: "no-key", escalated: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
