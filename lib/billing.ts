// Freemium gate (M5). Only `FREE` plan is currently rate-capped: an enterprise
// on FREE may not have more than 3 ACTIVE job offers at once. PAID plans
// (STARTER / PRO / future) are uncapped — `canCreateOffer` returns true.
//
// Decisions:
//   - The cap is on `OfferStatus = ACTIVE` (not DRAFT/PAUSED/CLOSED). DRAFTs
//     don't surface to candidates, so they don't consume a "slot".
//   - The threshold is hard-coded here rather than env-driven; pricing is a
//     product decision, not an ops knob. To change it, edit `FREE_PLAN_LIMIT`
//     and ship.
//   - Returns `false` when the enterprise can't be found — fail-closed.
//
// Pure data; no I/O beyond Prisma. Used by `POST /api/offers` and rendered
// server-side in the offers list to gate the "New offer" CTA.

import { prisma } from "./prisma";

export const FREE_PLAN_LIMIT = 3;
export const FREE_PLAN_NAME = "FREE";

export type OfferQuotaStatus = {
  plan: string;
  limit: number | null; // null = unlimited
  active: number;
  remaining: number | null; // null = unlimited
  canCreate: boolean;
};

/**
 * Returns true when the enterprise is allowed to create another ACTIVE offer
 * right now. Free plans are capped at FREE_PLAN_LIMIT; paid plans are
 * unlimited. An unknown enterprise id returns false (fail-closed).
 */
export async function canCreateOffer(enterpriseId: string): Promise<boolean> {
  const status = await getOfferQuota(enterpriseId);
  return status?.canCreate ?? false;
}

/**
 * Same logic as `canCreateOffer` but returns the surrounding context — useful
 * for the offers list page to render an "upgrade" CTA with real numbers.
 * Returns null when the enterprise does not exist.
 */
export async function getOfferQuota(
  enterpriseId: string,
): Promise<OfferQuotaStatus | null> {
  const ent = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    select: { plan: true },
  });
  if (!ent) return null;

  if (ent.plan !== FREE_PLAN_NAME) {
    return {
      plan: ent.plan,
      limit: null,
      active: await prisma.jobOffer.count({
        where: { enterpriseId, status: "ACTIVE" },
      }),
      remaining: null,
      canCreate: true,
    };
  }

  const active = await prisma.jobOffer.count({
    where: { enterpriseId, status: "ACTIVE" },
  });
  const remaining = Math.max(0, FREE_PLAN_LIMIT - active);
  return {
    plan: ent.plan,
    limit: FREE_PLAN_LIMIT,
    active,
    remaining,
    canCreate: active < FREE_PLAN_LIMIT,
  };
}
