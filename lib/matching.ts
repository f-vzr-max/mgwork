import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  DEFAULT_WEIGHTS,
  computeCompatibilityScore,
  type CompatibilityResult,
  type CompatibilityWeights,
  type ScoringCandidate,
  type ScoringOffer,
} from "./scoring";

export type CandidateMatch = {
  candidateId: string;
  score: number;
  breakdown: CompatibilityResult["breakdown"];
};

export type OfferMatch = {
  offerId: string;
  score: number;
  breakdown: CompatibilityResult["breakdown"];
};

const CANDIDATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  nationality: true,
  phone: true,
  city: true,
  langScoreFR: true,
  langScoreEN: true,
  cvFileUrl: true,
  bio: true,
  skills: true,
  sectors: true,
  documents: {
    where: { status: "APPROVED" as const },
    select: { type: true },
  },
} satisfies Prisma.CandidateSelect;

type CandidateRow = Prisma.CandidateGetPayload<{ select: typeof CANDIDATE_SELECT }>;

const OFFER_SELECT = {
  id: true,
  sector: true,
  requirements: true,
  langRequired: true,
} satisfies Prisma.JobOfferSelect;

type OfferRow = Prisma.JobOfferGetPayload<{ select: typeof OFFER_SELECT }>;

function toScoringCandidate(c: CandidateRow): ScoringCandidate {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    dateOfBirth: c.dateOfBirth ?? null,
    nationality: c.nationality,
    phone: c.phone,
    city: c.city,
    langScoreFR: c.langScoreFR,
    langScoreEN: c.langScoreEN,
    cvFileUrl: c.cvFileUrl,
    bio: c.bio,
    skills: c.skills,
    sectors: c.sectors,
    approvedDocumentTypes: c.documents.map((d) => d.type),
  };
}

function toScoringOffer(o: OfferRow): ScoringOffer {
  return {
    sector: o.sector,
    requirements: o.requirements,
    langRequired: o.langRequired,
  };
}

// Rank candidates against a single offer. Reads ACTIVE/relevant candidates
// (no status field on Candidate yet, so we read all). Returns up to `limit`
// best matches sorted by score desc.
export async function rankCandidatesForOffer(
  offerId: string,
  weights: CompatibilityWeights = DEFAULT_WEIGHTS,
  limit = 5,
): Promise<CandidateMatch[]> {
  const offer = await prisma.jobOffer.findUnique({
    where: { id: offerId },
    select: OFFER_SELECT,
  });
  if (!offer) return [];

  const scoringOffer = toScoringOffer(offer);
  const candidates = await prisma.candidate.findMany({ select: CANDIDATE_SELECT });

  const scored: CandidateMatch[] = candidates.map((c) => {
    const result = computeCompatibilityScore(toScoringCandidate(c), scoringOffer, weights);
    return { candidateId: c.id, score: result.total, breakdown: result.breakdown };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, limit));
}

// Find offers that fit a single candidate. Only ACTIVE offers — DRAFT / PAUSED
// / CLOSED don't surface to candidates.
export async function findOffersForCandidate(
  candidateId: string,
  weights: CompatibilityWeights = DEFAULT_WEIGHTS,
  limit = 20,
): Promise<OfferMatch[]> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: CANDIDATE_SELECT,
  });
  if (!candidate) return [];

  const scoringCandidate = toScoringCandidate(candidate);
  const offers = await prisma.jobOffer.findMany({
    where: { status: "ACTIVE" },
    select: OFFER_SELECT,
  });

  const scored: OfferMatch[] = offers.map((o) => {
    const result = computeCompatibilityScore(scoringCandidate, toScoringOffer(o), weights);
    return { offerId: o.id, score: result.total, breakdown: result.breakdown };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, limit));
}

// Persist top-N candidate matches for an offer. Wipes previous Matching rows
// for the offer first, then inserts fresh — keeps the table small and avoids
// stale-row drift when weights change.
export async function recomputeMatchings(
  offerId: string,
  weights: CompatibilityWeights = DEFAULT_WEIGHTS,
  limit = 5,
): Promise<CandidateMatch[]> {
  const top = await rankCandidatesForOffer(offerId, weights, limit);
  await prisma.$transaction([
    prisma.matching.deleteMany({ where: { jobOfferId: offerId } }),
    ...top.map((m) =>
      prisma.matching.create({
        data: {
          jobOfferId: offerId,
          candidateId: m.candidateId,
          score: m.score,
          criteria: m.breakdown as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  ]);
  return top;
}
