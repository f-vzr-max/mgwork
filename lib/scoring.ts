// Pure scoring functions. NO I/O — all data must be passed in by the caller.
// This keeps the module trivially unit-testable and allows the matching layer
// to vary which fields it loads from Prisma.

export type ScoringCandidate = {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  dateOfBirth: Date | string | null | undefined;
  nationality: string | null | undefined;
  phone: string | null | undefined;
  city: string | null | undefined;
  langScoreFR: number | null | undefined;
  langScoreEN: number | null | undefined;
  cvFileUrl: string | null | undefined;
  bio: string | null | undefined;
  skills: string[] | null | undefined;
  sectors: string[] | null | undefined;
  // Approved-document type list. Caller pre-filters to APPROVED only.
  approvedDocumentTypes?: string[];
};

export type ScoringOffer = {
  sector: string;
  requirements: string[]; // free-form skill / qualification tokens
  langRequired: string[]; // ["FR", "EN", ...] — uppercase ISO-ish codes
};

export type CompatibilityWeights = {
  skills: number;
  languages: number;
  sector: number;
  mobility: number;
  experience: number;
  documents: number;
};

export const DEFAULT_WEIGHTS: CompatibilityWeights = {
  skills: 30,
  languages: 20,
  sector: 15,
  mobility: 10,
  experience: 15,
  documents: 10,
};

export type CompatibilityBreakdown = Record<keyof CompatibilityWeights, number>;

export type CompatibilityResult = {
  total: number; // 0–100, rounded to nearest int
  breakdown: CompatibilityBreakdown; // each entry is the criterion's weighted contribution (0..weight)
};

// ---------------------------------------------------------------------------
// Profile completeness — produces 0..100 in fixed weight buckets.
// Buckets per the M1 spec: identity 20, languages 20, skills 25, sectors 10,
// CV 15, documents 10.
// ---------------------------------------------------------------------------

const PROFILE_WEIGHTS = {
  identity: 20,
  languages: 20,
  skills: 25,
  sectors: 10,
  cv: 15,
  documents: 10,
} as const;

export function computeProfileScore(c: ScoringCandidate): number {
  let total = 0;
  total += scoreIdentity(c) * PROFILE_WEIGHTS.identity;
  total += scoreLanguages(c) * PROFILE_WEIGHTS.languages;
  total += scoreSkillsCompleteness(c) * PROFILE_WEIGHTS.skills;
  total += scoreSectorsCompleteness(c) * PROFILE_WEIGHTS.sectors;
  total += scoreCv(c) * PROFILE_WEIGHTS.cv;
  total += scoreDocumentsCompleteness(c) * PROFILE_WEIGHTS.documents;
  return clampInt(total, 0, 100);
}

function scoreIdentity(c: ScoringCandidate): number {
  // Five sub-fields, equal-weighted.
  const present = [
    nonEmpty(c.firstName),
    nonEmpty(c.lastName),
    c.dateOfBirth != null,
    nonEmpty(c.city),
    nonEmpty(c.phone),
  ].filter(Boolean).length;
  return present / 5;
}

function scoreLanguages(c: ScoringCandidate): number {
  // Each lang contributes proportionally to its self-assessed score.
  const fr = clamp01((c.langScoreFR ?? 0) / 100);
  const en = clamp01((c.langScoreEN ?? 0) / 100);
  return (fr + en) / 2;
}

function scoreSkillsCompleteness(c: ScoringCandidate): number {
  const n = (c.skills ?? []).length;
  // Caps at 5 skills for full credit — enough variety, prevents stuffing.
  return Math.min(n, 5) / 5;
}

function scoreSectorsCompleteness(c: ScoringCandidate): number {
  const n = (c.sectors ?? []).length;
  // 1 sector = full credit; 0 = none.
  return n >= 1 ? 1 : 0;
}

function scoreCv(c: ScoringCandidate): number {
  if (nonEmpty(c.cvFileUrl)) return 1;
  if (nonEmpty(c.bio)) return 0.4;
  return 0;
}

function scoreDocumentsCompleteness(c: ScoringCandidate): number {
  // Full credit when passport AND medical authorization present (the two
  // gating documents for any deployment).
  const types = c.approvedDocumentTypes ?? [];
  const hasPassport = types.includes("PASSPORT");
  const hasMedical = types.includes("MEDICAL_AUTHORIZATION");
  if (hasPassport && hasMedical) return 1;
  if (hasPassport || hasMedical) return 0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Compatibility — candidate × offer.
// Each criterion produces a 0..1 ratio that is multiplied by its weight; total
// is the sum normalized against the sum of weights.
// ---------------------------------------------------------------------------

export function computeCompatibilityScore(
  candidate: ScoringCandidate,
  offer: ScoringOffer,
  weights: CompatibilityWeights = DEFAULT_WEIGHTS,
): CompatibilityResult {
  const ratios: CompatibilityBreakdown = {
    skills: skillsRatio(candidate, offer),
    languages: languagesRatio(candidate, offer),
    sector: sectorRatio(candidate, offer),
    mobility: mobilityRatio(candidate),
    experience: experienceRatio(candidate),
    documents: documentsRatio(candidate),
  };

  const breakdown: CompatibilityBreakdown = {
    skills: round2(ratios.skills * weights.skills),
    languages: round2(ratios.languages * weights.languages),
    sector: round2(ratios.sector * weights.sector),
    mobility: round2(ratios.mobility * weights.mobility),
    experience: round2(ratios.experience * weights.experience),
    documents: round2(ratios.documents * weights.documents),
  };

  const weightSum =
    weights.skills +
    weights.languages +
    weights.sector +
    weights.mobility +
    weights.experience +
    weights.documents;

  if (weightSum <= 0) {
    return { total: 0, breakdown };
  }

  const totalRaw =
    breakdown.skills +
    breakdown.languages +
    breakdown.sector +
    breakdown.mobility +
    breakdown.experience +
    breakdown.documents;
  const total = clampInt(Math.round((totalRaw / weightSum) * 100), 0, 100);

  return { total, breakdown };
}

function skillsRatio(c: ScoringCandidate, o: ScoringOffer): number {
  const required = normalizeTokens(o.requirements);
  if (required.length === 0) return 1;
  const have = new Set(normalizeTokens(c.skills ?? []));
  let hits = 0;
  for (const r of required) if (have.has(r)) hits += 1;
  return hits / required.length;
}

function languagesRatio(c: ScoringCandidate, o: ScoringOffer): number {
  const required = (o.langRequired ?? []).map((s) => s.toUpperCase());
  if (required.length === 0) return 1;
  let total = 0;
  for (const code of required) {
    if (code === "FR") total += clamp01((c.langScoreFR ?? 0) / 100);
    else if (code === "EN") total += clamp01((c.langScoreEN ?? 0) / 100);
    else total += 0.5; // unknown lang code — give partial credit so we don't punish edge cases
  }
  return total / required.length;
}

function sectorRatio(c: ScoringCandidate, o: ScoringOffer): number {
  const offerSector = o.sector?.trim().toLowerCase();
  if (!offerSector) return 1;
  const candSectors = (c.sectors ?? []).map((s) => s.trim().toLowerCase());
  return candSectors.includes(offerSector) ? 1 : 0;
}

function mobilityRatio(c: ScoringCandidate): number {
  // No explicit mobility field on Candidate yet — proxy via documents:
  // having a passport implies real intent to relocate.
  const types = c.approvedDocumentTypes ?? [];
  if (types.includes("VISA") || types.includes("WORK_PERMIT")) return 1;
  if (types.includes("PASSPORT")) return 0.7;
  return 0.3;
}

function experienceRatio(c: ScoringCandidate): number {
  // Proxy until a structured experience field exists: weighted by skill count
  // and CV presence.
  const skillCount = Math.min((c.skills ?? []).length, 5);
  const cvBonus = nonEmpty(c.cvFileUrl) ? 0.4 : nonEmpty(c.bio) ? 0.15 : 0;
  return clamp01(skillCount / 5 * 0.6 + cvBonus);
}

function documentsRatio(c: ScoringCandidate): number {
  const types = c.approvedDocumentTypes ?? [];
  const required = ["PASSPORT", "MEDICAL_AUTHORIZATION"];
  const have = required.filter((t) => types.includes(t)).length;
  return have / required.length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeTokens(tokens: readonly string[]): string[] {
  return tokens.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampInt(n: number, lo: number, hi: number): number {
  const v = Math.round(n);
  if (Number.isNaN(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
