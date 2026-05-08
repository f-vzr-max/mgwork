// MatchingConfig singleton accessor (M5).
//
// The MatchingConfig table is treated as a single-row store: there's at most
// one row, and we read/write it by a fixed sentinel id `singleton`. This keeps
// the admin UI trivial (no row picker) and means recompute callers can fetch
// "the" current weights with a single query.
//
// On read: if no row exists, we return DEFAULT_WEIGHTS. Callers should never
// have to special-case "uninitialized config".
//
// On write: we use upsert with a fixed id. Concurrent writes resolve by last
// write wins. Validating the weight shape is the schema's job (lib/validation
// /admin.ts).

import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_WEIGHTS, type CompatibilityWeights } from "./scoring";

export const MATCHING_CONFIG_ID = "singleton";

function isValidWeights(value: unknown): value is CompatibilityWeights {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.skills === "number" &&
    typeof v.languages === "number" &&
    typeof v.sector === "number" &&
    typeof v.mobility === "number" &&
    typeof v.experience === "number" &&
    typeof v.documents === "number"
  );
}

/**
 * Fetch the active matching weights. Falls back to DEFAULT_WEIGHTS when the
 * config row does not exist or is malformed.
 */
export async function getMatchingWeights(): Promise<CompatibilityWeights> {
  const row = await prisma.matchingConfig.findUnique({
    where: { id: MATCHING_CONFIG_ID },
    select: { weights: true },
  });
  if (!row) return { ...DEFAULT_WEIGHTS };
  return isValidWeights(row.weights) ? row.weights : { ...DEFAULT_WEIGHTS };
}

/**
 * Upsert the singleton row with the supplied weights. Returns the canonical
 * shape stored.
 */
export async function setMatchingWeights(
  weights: CompatibilityWeights,
  updatedById?: string,
): Promise<CompatibilityWeights> {
  const data = {
    weights: weights as unknown as Prisma.InputJsonValue,
    updatedById,
  };
  await prisma.matchingConfig.upsert({
    where: { id: MATCHING_CONFIG_ID },
    create: { id: MATCHING_CONFIG_ID, ...data },
    update: data,
  });
  return weights;
}
