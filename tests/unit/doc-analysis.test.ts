// Unit tests for lib/ai/doc-analysis.ts — pure helpers only (parsing,
// mismatch rule, persisted-Json reader, advisory flag). The impure runners
// (Claude + Prisma + Supabase) are exercised by integration, not here.

import {
  computeMismatch,
  docAiFlag,
  hasAnalysisBlock,
  isAnalyzableMime,
  normalizeExpiryDate,
  parseAnalysisBlock,
  readDocAiAnalysis,
  type DocAiAnalysis,
} from "@/lib/ai/doc-analysis";

const NOW = new Date("2026-06-11T12:00:00Z");

function analysis(overrides: Partial<DocAiAnalysis> = {}): DocAiAnalysis {
  return {
    detectedType: "PASSPORT",
    expiryDate: null,
    mismatch: false,
    confidence: 0.9,
    analyzedAt: NOW.toISOString(),
    escalated: false,
    ...overrides,
  };
}

describe("parseAnalysisBlock", () => {
  it("parses a well-formed <analysis> block", () => {
    const text = `<analysis>{"detectedType":"VISA","expiryDate":"2027-01-15","confidence":0.85}</analysis>`;
    expect(parseAnalysisBlock(text)).toEqual({
      detectedType: "VISA",
      expiryDate: "2027-01-15",
      confidence: 0.85,
    });
  });

  it("falls back to bare JSON when the block tags are missing", () => {
    const text = `{"detectedType":"passport","expiryDate":null,"confidence":1}`;
    expect(parseAnalysisBlock(text)).toEqual({
      detectedType: "PASSPORT", // case-normalized
      expiryDate: null,
      confidence: 1,
    });
  });

  it("rejects an unknown detectedType", () => {
    const text = `<analysis>{"detectedType":"DRIVER_LICENSE","confidence":0.9}</analysis>`;
    expect(parseAnalysisBlock(text)).toBeNull();
  });

  it("rejects garbled JSON", () => {
    expect(parseAnalysisBlock("<analysis>not json</analysis>")).toBeNull();
    expect(parseAnalysisBlock("plain prose, no block")).toBeNull();
  });

  it("clamps confidence into [0, 1] and defaults non-numbers to 0", () => {
    const high = parseAnalysisBlock(
      `<analysis>{"detectedType":"OTHER","confidence":4.2}</analysis>`,
    );
    expect(high?.confidence).toBe(1);
    const missing = parseAnalysisBlock(
      `<analysis>{"detectedType":"OTHER"}</analysis>`,
    );
    expect(missing?.confidence).toBe(0);
  });
});

describe("hasAnalysisBlock", () => {
  it("mirrors parseAnalysisBlock success/failure", () => {
    expect(
      hasAnalysisBlock(`<analysis>{"detectedType":"VISA","confidence":1}</analysis>`),
    ).toBe(true);
    expect(hasAnalysisBlock("nope")).toBe(false);
  });
});

describe("normalizeExpiryDate", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(normalizeExpiryDate("2027-02-28")).toBe("2027-02-28");
  });
  it("rejects non-ISO formats", () => {
    expect(normalizeExpiryDate("28/02/2027")).toBeNull();
    expect(normalizeExpiryDate("2027-2-8")).toBeNull();
  });
  it("rejects impossible calendar dates", () => {
    expect(normalizeExpiryDate("2026-02-30")).toBeNull();
  });
  it("rejects non-strings", () => {
    expect(normalizeExpiryDate(20270228)).toBeNull();
    expect(normalizeExpiryDate(null)).toBeNull();
  });
});

describe("computeMismatch", () => {
  it("is false when declared and detected agree", () => {
    expect(computeMismatch("PASSPORT", "PASSPORT", 0.99)).toBe(false);
  });
  it("flags a confident concrete disagreement", () => {
    expect(computeMismatch("PASSPORT", "VISA", 0.8)).toBe(true);
  });
  it("does not flag low-confidence disagreement", () => {
    expect(computeMismatch("PASSPORT", "VISA", 0.3)).toBe(false);
  });
  it("treats OTHER on either side as inconclusive", () => {
    expect(computeMismatch("OTHER", "PASSPORT", 0.99)).toBe(false);
    expect(computeMismatch("PASSPORT", "OTHER", 0.99)).toBe(false);
  });
});

describe("readDocAiAnalysis", () => {
  it("round-trips a persisted analysis object", () => {
    const stored = analysis({ expiryDate: "2027-01-01", mismatch: true });
    expect(readDocAiAnalysis(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
  it("returns null for non-objects and arrays", () => {
    expect(readDocAiAnalysis(null)).toBeNull();
    expect(readDocAiAnalysis("PASSPORT")).toBeNull();
    expect(readDocAiAnalysis([])).toBeNull();
  });
  it("returns null when detectedType is missing or unknown", () => {
    expect(readDocAiAnalysis({ mismatch: true })).toBeNull();
    expect(readDocAiAnalysis({ detectedType: "BOGUS" })).toBeNull();
  });
  it("sanitizes loose fields instead of failing", () => {
    const got = readDocAiAnalysis({
      detectedType: "VISA",
      expiryDate: "not-a-date",
      mismatch: "yes", // not boolean true
      confidence: 7,
    });
    expect(got).toEqual({
      detectedType: "VISA",
      expiryDate: null,
      mismatch: false,
      confidence: 1,
      analyzedAt: "",
      escalated: false,
    });
  });
});

describe("docAiFlag", () => {
  it("returns null without an analysis", () => {
    expect(docAiFlag(null, NOW)).toBeNull();
  });
  it("returns null when nothing is wrong", () => {
    expect(docAiFlag(analysis({ expiryDate: "2030-01-01" }), NOW)).toBeNull();
  });
  it("flags a mismatch", () => {
    expect(docAiFlag(analysis({ mismatch: true }), NOW)).toEqual({
      mismatch: true,
      expiry: null,
    });
  });
  it("flags an expired detected date", () => {
    expect(docAiFlag(analysis({ expiryDate: "2026-01-01" }), NOW)).toEqual({
      mismatch: false,
      expiry: "expired",
    });
  });
  it("flags a near-expiry detected date (≤30 days)", () => {
    expect(docAiFlag(analysis({ expiryDate: "2026-07-01" }), NOW)).toEqual({
      mismatch: false,
      expiry: "soon",
    });
  });
  it("carries both signals at once", () => {
    expect(
      docAiFlag(analysis({ mismatch: true, expiryDate: "2026-01-01" }), NOW),
    ).toEqual({ mismatch: true, expiry: "expired" });
  });
});

describe("isAnalyzableMime", () => {
  it("accepts JPEG/PNG regardless of case", () => {
    expect(isAnalyzableMime("image/jpeg")).toBe(true);
    expect(isAnalyzableMime("IMAGE/PNG")).toBe(true);
  });
  it("rejects PDFs, DOCX, and empties", () => {
    expect(isAnalyzableMime("application/pdf")).toBe(false);
    expect(
      isAnalyzableMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(false);
    expect(isAnalyzableMime("")).toBe(false);
    expect(isAnalyzableMime(null)).toBe(false);
  });
});
