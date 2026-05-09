import {
  applicationCreateSchema,
  applicationUpdateSchema,
} from "@/lib/validation/application";

const CUID = "ckxyz123abc456def789ghijk";

describe("applicationCreateSchema", () => {
  it("accepts valid input", () => {
    const r = applicationCreateSchema.parse({
      candidateId: CUID,
      jobOfferId: CUID,
      notes: "strong fit",
    });
    expect(r.candidateId).toBe(CUID);
  });

  it("rejects missing candidateId", () => {
    expect(() => applicationCreateSchema.parse({ jobOfferId: CUID })).toThrow();
  });

  it("rejects malformed CUID", () => {
    expect(() =>
      applicationCreateSchema.parse({ candidateId: "abc", jobOfferId: CUID }),
    ).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      applicationCreateSchema.parse({
        candidateId: CUID,
        jobOfferId: CUID,
        bogus: true,
      }),
    ).toThrow();
  });
});

describe("applicationUpdateSchema", () => {
  it("accepts a status change", () => {
    const r = applicationUpdateSchema.parse({ status: "SHORTLISTED" });
    expect(r.status).toBe("SHORTLISTED");
  });

  it("accepts an aiScore in range", () => {
    const r = applicationUpdateSchema.parse({ aiScore: 87 });
    expect(r.aiScore).toBe(87);
  });

  it("rejects an out-of-range aiScore", () => {
    expect(() => applicationUpdateSchema.parse({ aiScore: 150 })).toThrow();
    expect(() => applicationUpdateSchema.parse({ aiScore: -1 })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => applicationUpdateSchema.parse({ status: "BOGUS" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => applicationUpdateSchema.parse({ extra: 1 })).toThrow();
  });
});
