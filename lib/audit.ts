import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditMetadata = Prisma.InputJsonValue;

export type AuditPayload = {
  // Internal User.id (cuid). NOT the Clerk user ID — translate via getInternalUserId.
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: AuditMetadata;
};

// Resolve a Clerk user ID to the internal User.id (cuid). Returns null when
// the user has not been synced yet (Clerk webhook race) — caller decides how
// to handle. Cached briefly in-process to dampen common-case latency.
const clerkLookupCache = new Map<string, { id: string; expiresAt: number }>();
const CLERK_LOOKUP_TTL_MS = 30_000;

export async function getInternalUserId(clerkId: string): Promise<string | null> {
  const now = Date.now();
  const cached = clerkLookupCache.get(clerkId);
  if (cached && cached.expiresAt > now) return cached.id;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) return null;

  clerkLookupCache.set(clerkId, { id: user.id, expiresAt: now + CLERK_LOOKUP_TTL_MS });
  return user.id;
}

// Convenience: log audit events keyed by Clerk user ID. Returns false when the
// user hasn't been synced yet (no log written).
export async function logAuditByClerkId(
  clerkId: string,
  payload: Omit<AuditPayload, "userId">,
): Promise<boolean> {
  const internalId = await getInternalUserId(clerkId);
  if (!internalId) return false;
  await logAudit({ ...payload, userId: internalId });
  return true;
}

// Write a single audit event. Failures are logged but never thrown — auditing
// must never block a successful business operation.
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        ipAddress: payload.ipAddress,
        ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit:write-failed]", {
      action: payload.action,
      resourceType: payload.resourceType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Test-only: clear the Clerk lookup cache.
export function _resetAuditCache(): void {
  clerkLookupCache.clear();
}
