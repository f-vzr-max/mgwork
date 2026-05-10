import { candidateCreateSchema, candidateUpdateSchema } from "@/lib/validation/candidate";

describe("candidateCreateSchema", () => {
  it("accepts a valid minimal payload", () => {
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
    });
    expect(r.firstName).toBe("Jean");
    expect(r.nationality).toBe("MG"); // default
    expect(r.skills).toEqual([]);
    expect(r.sectors).toEqual([]);
  });

  it("accepts a fully populated payload", () => {
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
      dateOfBirth: "1990-01-15",
      nationality: "MG",
      phone: "+261341234567",
      city: "Antananarivo",
      bio: "Senior welder",
      skills: ["welding", "tig"],
      sectors: ["construction"],
      langScoreFR: 80,
      langScoreEN: 60,
      cvFileUrl: "https://example.com/cv.pdf",
    });
    expect(r.cvFileUrl).toBe("https://example.com/cv.pdf");
    expect(r.skills).toHaveLength(2);
  });

  it("fails when required fields are missing", () => {
    expect(() => candidateCreateSchema.parse({ firstName: "Jean" })).toThrow();
    expect(() => candidateCreateSchema.parse({})).toThrow();
  });

  it("rejects unknown keys (.strict())", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        someExtra: "should fail",
      }),
    ).toThrow();
  });

  it("rejects an out-of-range language score", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        langScoreFR: 150,
      }),
    ).toThrow();
  });

  it("rejects an invalid CV URL", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        cvFileUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects a malformed phone", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        phone: "abc",
      }),
    ).toThrow();
  });

  it("normalises a 0-prefixed phone to +261", () => {
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
      phone: "034 12 345 67",
    });
    expect(r.phone).toBe("+261341234567");
  });

  it("normalises a bare-digit phone to +261", () => {
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
      phone: "341234567",
    });
    expect(r.phone).toBe("+261341234567");
  });

  it("preserves an already-normalised +261 phone", () => {
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
      phone: "+261341234567",
    });
    expect(r.phone).toBe("+261341234567");
  });

  it("rejects a too-short phone (less than 9 digits after +261)", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        phone: "+2611234",
      }),
    ).toThrow();
  });

  it("rejects a too-long phone (more than 9 digits after +261)", () => {
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        phone: "+26134123456789",
      }),
    ).toThrow();
  });

  it("rejects a DOB less than 18 years ago", () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 17);
    expect(() =>
      candidateCreateSchema.parse({
        firstName: "Jean",
        lastName: "Rakoto",
        dateOfBirth: recent.toISOString().slice(0, 10),
      }),
    ).toThrow();
  });

  it("accepts a DOB exactly 18 years ago", () => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    const r = candidateCreateSchema.parse({
      firstName: "Jean",
      lastName: "Rakoto",
      dateOfBirth: cutoff.toISOString().slice(0, 10),
    });
    expect(r.dateOfBirth).toBeInstanceOf(Date);
  });
});

describe("candidateUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    // .partial() keeps `.default()` values, so empty parse fills defaults.
    const r = candidateUpdateSchema.parse({});
    expect(() => candidateUpdateSchema.parse({})).not.toThrow();
    expect(r.nationality).toBe("MG");
  });

  it("accepts a partial update", () => {
    const r = candidateUpdateSchema.parse({ city: "Mahajanga" });
    expect(r.city).toBe("Mahajanga");
  });

  it("rejects unknown keys", () => {
    expect(() => candidateUpdateSchema.parse({ extra: "no" })).toThrow();
  });
});
