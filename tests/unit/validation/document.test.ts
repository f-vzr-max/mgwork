import {
  documentCreateSchema,
  documentUpdateSchema,
  documentApproveSchema,
  documentRejectSchema,
} from "@/lib/validation/document";

// CUIDs are 25 chars, start with 'c'.
const CUID = "ckxyz123abc456def789ghijk";

describe("documentCreateSchema", () => {
  it("accepts a candidate document", () => {
    const r = documentCreateSchema.parse({
      type: "PASSPORT",
      fileUrl: "https://example.com/passport.pdf",
      candidateId: CUID,
    });
    expect(r.type).toBe("PASSPORT");
    expect(r.candidateId).toBe(CUID);
  });

  it("accepts an enterprise document", () => {
    const r = documentCreateSchema.parse({
      type: "INCORPORATION_CERTIFICATE",
      fileUrl: "https://example.com/inc.pdf",
      enterpriseId: CUID,
    });
    expect(r.enterpriseId).toBe(CUID);
  });

  it("rejects when both candidateId and enterpriseId are present", () => {
    expect(() =>
      documentCreateSchema.parse({
        type: "PASSPORT",
        fileUrl: "https://example.com/x.pdf",
        candidateId: CUID,
        enterpriseId: CUID,
      }),
    ).toThrow();
  });

  it("rejects when neither owner id is present", () => {
    expect(() =>
      documentCreateSchema.parse({
        type: "PASSPORT",
        fileUrl: "https://example.com/x.pdf",
      }),
    ).toThrow();
  });

  it("rejects an unknown document type", () => {
    expect(() =>
      documentCreateSchema.parse({
        type: "BIRTH_CERTIFICATE",
        fileUrl: "https://example.com/x.pdf",
        candidateId: CUID,
      }),
    ).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      documentCreateSchema.parse({
        type: "PASSPORT",
        fileUrl: "https://example.com/x.pdf",
        candidateId: CUID,
        bogus: true,
      }),
    ).toThrow();
  });

  it("rejects bad file URL", () => {
    expect(() =>
      documentCreateSchema.parse({
        type: "PASSPORT",
        fileUrl: "not a url",
        candidateId: CUID,
      }),
    ).toThrow();
  });
});

describe("documentUpdateSchema", () => {
  it("accepts a status change", () => {
    const r = documentUpdateSchema.parse({ status: "APPROVED" });
    expect(r.status).toBe("APPROVED");
  });

  it("accepts an empty object", () => {
    expect(documentUpdateSchema.parse({})).toEqual({});
  });

  it("rejects unknown keys", () => {
    expect(() => documentUpdateSchema.parse({ junk: 1 })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => documentUpdateSchema.parse({ status: "WAT" })).toThrow();
  });
});

describe("documentApproveSchema", () => {
  it("accepts an empty object or note", () => {
    expect(documentApproveSchema.parse({})).toEqual({});
    expect(documentApproveSchema.parse({ note: "ok" })).toEqual({ note: "ok" });
  });

  it("rejects unknown keys", () => {
    expect(() => documentApproveSchema.parse({ extra: true })).toThrow();
  });
});

describe("documentRejectSchema", () => {
  it("requires a reason", () => {
    expect(() => documentRejectSchema.parse({})).toThrow();
  });

  it("accepts a valid reason", () => {
    expect(documentRejectSchema.parse({ reason: "blurry scan" })).toEqual({
      reason: "blurry scan",
    });
  });

  it("rejects unknown keys", () => {
    expect(() =>
      documentRejectSchema.parse({ reason: "x", extra: "y" }),
    ).toThrow();
  });
});
