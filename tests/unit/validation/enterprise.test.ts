import { enterpriseCreateSchema, enterpriseUpdateSchema } from "@/lib/validation/enterprise";

describe("enterpriseCreateSchema", () => {
  it("accepts a minimal payload and applies defaults", () => {
    const r = enterpriseCreateSchema.parse({ companyName: "Acme Co" });
    expect(r.companyName).toBe("Acme Co");
    expect(r.plan).toBe("FREE");
  });

  it("accepts a full payload", () => {
    const r = enterpriseCreateSchema.parse({
      companyName: "Acme Co",
      registrationNumber: "RN-12345",
      sector: "construction",
      address: "123 Main St",
      contactName: "Jane Doe",
      contactPhone: "+261341234567",
      plan: "PRO",
    });
    expect(r.plan).toBe("PRO");
    expect(r.contactPhone).toBe("+261341234567");
  });

  it("normalises a 0-prefixed contact phone to +261", () => {
    const r = enterpriseCreateSchema.parse({
      companyName: "Acme Co",
      contactPhone: "034 12 345 67",
    });
    expect(r.contactPhone).toBe("+261341234567");
  });

  it("normalises a bare-digit contact phone to +261", () => {
    const r = enterpriseCreateSchema.parse({
      companyName: "Acme Co",
      contactPhone: "341234567",
    });
    expect(r.contactPhone).toBe("+261341234567");
  });

  it("normalises a +230 (Mauritius) contact phone", () => {
    const r = enterpriseCreateSchema.parse({
      companyName: "Acme Co",
      contactPhone: "+230 5123 4567",
    });
    expect(r.contactPhone).toBe("+23051234567");
  });

  it("rejects when companyName missing", () => {
    expect(() => enterpriseCreateSchema.parse({})).toThrow();
  });

  it("rejects unknown keys (.strict())", () => {
    expect(() =>
      enterpriseCreateSchema.parse({ companyName: "Acme", extra: "no" }),
    ).toThrow();
  });

  it("rejects an unknown plan value", () => {
    expect(() =>
      enterpriseCreateSchema.parse({ companyName: "Acme", plan: "ENTERPRISE" }),
    ).toThrow();
  });

  it("rejects bad phone", () => {
    expect(() =>
      enterpriseCreateSchema.parse({ companyName: "Acme", contactPhone: "abc" }),
    ).toThrow();
  });
});

describe("enterpriseUpdateSchema", () => {
  it("accepts an empty object (defaults applied)", () => {
    expect(() => enterpriseUpdateSchema.parse({})).not.toThrow();
    expect(enterpriseUpdateSchema.parse({}).plan).toBe("FREE");
  });

  it("accepts a partial update", () => {
    const r = enterpriseUpdateSchema.parse({ sector: "hospitality" });
    expect(r.sector).toBe("hospitality");
  });

  it("rejects unknown keys", () => {
    expect(() => enterpriseUpdateSchema.parse({ extra: 1 })).toThrow();
  });
});
