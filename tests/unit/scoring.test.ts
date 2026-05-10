import {
  computeProfileScore,
  computeCompatibilityScore,
  DEFAULT_WEIGHTS,
  type ScoringCandidate,
  type ScoringOffer,
} from "@/lib/scoring";

// Empty / minimal candidate — every signal absent.
const emptyCandidate: ScoringCandidate = {
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  nationality: null,
  phone: null,
  city: null,
  langScoreFR: null,
  langScoreEN: null,
  cvFileUrl: null,
  bio: null,
  skills: [],
  sectors: [],
  approvedDocumentTypes: [],
};

// Fully-populated candidate — every signal present at max value.
const fullCandidate: ScoringCandidate = {
  firstName: "Jean",
  lastName: "Rakoto",
  dateOfBirth: new Date("1990-01-15"),
  nationality: "MG",
  phone: "+261341234567",
  city: "Antananarivo",
  langScoreFR: 100,
  langScoreEN: 100,
  cvFileUrl: "https://example.com/cv.pdf",
  bio: "Senior welder with 10 years experience",
  skills: ["welding", "blueprint reading", "safety", "tig", "mig"],
  sectors: ["construction"],
  approvedDocumentTypes: ["PASSPORT", "MEDICAL_AUTHORIZATION", "VISA"],
};

describe("computeProfileScore", () => {
  it("returns a low score for an empty candidate", () => {
    const s = computeProfileScore(emptyCandidate);
    expect(s).toBe(0);
  });

  it("returns 100 for a fully populated candidate", () => {
    const s = computeProfileScore(fullCandidate);
    expect(s).toBe(100);
  });

  it("drops by ~15 (the CV bucket) when the CV is missing entirely", () => {
    const noCv: ScoringCandidate = { ...fullCandidate, cvFileUrl: null, bio: null };
    const full = computeProfileScore(fullCandidate);
    const without = computeProfileScore(noCv);
    expect(full - without).toBe(15);
  });

  it("gives partial CV credit when only bio is present", () => {
    const bioOnly: ScoringCandidate = { ...fullCandidate, cvFileUrl: null };
    const full = computeProfileScore(fullCandidate);
    const partial = computeProfileScore(bioOnly);
    // 0.4 * 15 = 6, so missing CV but with bio drops by 9.
    expect(full - partial).toBe(9);
  });

  it("clamps to 0..100", () => {
    const s = computeProfileScore(fullCandidate);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("computeCompatibilityScore", () => {
  const baseOffer: ScoringOffer = {
    sector: "construction",
    requirements: ["welding", "safety"],
    langRequired: ["FR"],
  };

  it("scores 100 when all criteria fully met", () => {
    const result = computeCompatibilityScore(fullCandidate, baseOffer);
    expect(result.total).toBe(100);
    expect(result.breakdown.skills).toBe(DEFAULT_WEIGHTS.skills);
    expect(result.breakdown.languages).toBe(DEFAULT_WEIGHTS.languages);
    expect(result.breakdown.sector).toBe(DEFAULT_WEIGHTS.sector);
  });

  it("gives full skill credit when all required skills are present", () => {
    const result = computeCompatibilityScore(fullCandidate, baseOffer);
    expect(result.breakdown.skills).toBe(DEFAULT_WEIGHTS.skills);
  });

  it("gives partial skill credit when only some required skills are present", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: ["welding", "scaffolding", "rigging", "ironwork"],
      langRequired: [],
    };
    const result = computeCompatibilityScore(fullCandidate, offer);
    // Only "welding" matches → 1/4 ratio.
    expect(result.breakdown.skills).toBeCloseTo(DEFAULT_WEIGHTS.skills * 0.25, 2);
  });

  it("gives zero skill credit when no required skills overlap", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: ["accounting", "finance"],
      langRequired: [],
    };
    const result = computeCompatibilityScore(fullCandidate, offer);
    expect(result.breakdown.skills).toBe(0);
  });

  it("rewards full language credit when requirement is met", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: [],
      langRequired: ["FR"],
    };
    const cand: ScoringCandidate = { ...fullCandidate, langScoreFR: 100 };
    const result = computeCompatibilityScore(cand, offer);
    expect(result.breakdown.languages).toBe(DEFAULT_WEIGHTS.languages);
  });

  it("gives zero language credit when requirement unmet", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: [],
      langRequired: ["FR"],
    };
    const cand: ScoringCandidate = { ...fullCandidate, langScoreFR: 0 };
    const result = computeCompatibilityScore(cand, offer);
    expect(result.breakdown.languages).toBe(0);
  });

  it("gives full sector credit on match", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: [],
      langRequired: [],
    };
    const result = computeCompatibilityScore(fullCandidate, offer);
    expect(result.breakdown.sector).toBe(DEFAULT_WEIGHTS.sector);
  });

  it("gives zero sector credit on mismatch", () => {
    const offer: ScoringOffer = {
      sector: "hospitality",
      requirements: [],
      langRequired: [],
    };
    const result = computeCompatibilityScore(fullCandidate, offer);
    expect(result.breakdown.sector).toBe(0);
  });

  it("returns 0 total for empty candidate", () => {
    const result = computeCompatibilityScore(emptyCandidate, baseOffer);
    expect(result.total).toBeLessThan(20);
  });

  it("treats requirements case-insensitively / trims whitespace", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: ["  WELDING  ", "Safety"],
      langRequired: [],
    };
    const result = computeCompatibilityScore(fullCandidate, offer);
    expect(result.breakdown.skills).toBe(DEFAULT_WEIGHTS.skills);
  });

  it("gives full credit when no language is required", () => {
    const offer: ScoringOffer = {
      sector: "construction",
      requirements: [],
      langRequired: [],
    };
    const result = computeCompatibilityScore(emptyCandidate, offer);
    // No requirements → languages, skills, sector all return 1.
    expect(result.breakdown.languages).toBe(DEFAULT_WEIGHTS.languages);
  });
});
