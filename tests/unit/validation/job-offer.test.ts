import { jobOfferCreateSchema, jobOfferUpdateSchema } from "@/lib/validation/job-offer";

describe("jobOfferCreateSchema", () => {
  it("accepts a minimal valid offer and applies defaults", () => {
    const r = jobOfferCreateSchema.parse({
      title: "Welder needed",
      description: "Experienced welder for 6-month project.",
      sector: "construction",
    });
    expect(r.location).toBe("Mauritius");
    expect(r.slots).toBe(1);
    expect(r.status).toBe("DRAFT");
    expect(r.requirements).toEqual([]);
    expect(r.langRequired).toEqual([]);
  });

  it("accepts a full offer", () => {
    const r = jobOfferCreateSchema.parse({
      title: "Welder",
      description: "Build pipelines",
      sector: "construction",
      location: "Port Louis",
      slots: 5,
      status: "ACTIVE",
      requirements: ["welding", "tig"],
      langRequired: ["FR", "EN"],
    });
    expect(r.slots).toBe(5);
    expect(r.langRequired).toContain("FR");
  });

  it("rejects when required fields missing", () => {
    expect(() => jobOfferCreateSchema.parse({})).toThrow();
    expect(() => jobOfferCreateSchema.parse({ title: "x" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      jobOfferCreateSchema.parse({
        title: "x",
        description: "y",
        sector: "z",
        bogus: 1,
      }),
    ).toThrow();
  });

  it("rejects unsupported language codes", () => {
    expect(() =>
      jobOfferCreateSchema.parse({
        title: "x",
        description: "y",
        sector: "z",
        langRequired: ["DE"],
      }),
    ).toThrow();
  });

  it("rejects an invalid status", () => {
    expect(() =>
      jobOfferCreateSchema.parse({
        title: "x",
        description: "y",
        sector: "z",
        status: "ZOMBIE",
      }),
    ).toThrow();
  });

  it("rejects negative slot count", () => {
    expect(() =>
      jobOfferCreateSchema.parse({
        title: "x",
        description: "y",
        sector: "z",
        slots: 0,
      }),
    ).toThrow();
  });
});

describe("jobOfferUpdateSchema", () => {
  it("accepts an empty object (defaults applied)", () => {
    expect(() => jobOfferUpdateSchema.parse({})).not.toThrow();
    const r = jobOfferUpdateSchema.parse({});
    expect(r.status).toBe("DRAFT");
    expect(r.location).toBe("Mauritius");
  });

  it("accepts a partial update", () => {
    const r = jobOfferUpdateSchema.parse({ status: "ACTIVE" });
    expect(r.status).toBe("ACTIVE");
  });

  it("rejects unknown keys", () => {
    expect(() => jobOfferUpdateSchema.parse({ extra: true })).toThrow();
  });
});
