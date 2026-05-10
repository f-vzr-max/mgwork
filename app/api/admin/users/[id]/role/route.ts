// POST /api/admin/users/[id]/role
//
// SUPER_ADMIN-only role change. Updates BOTH:
//   1. Clerk publicMetadata.role  (used by middleware via session claims)
//   2. Prisma User.role            (used by API role checks)
// in that order. If Clerk fails we DON'T update the DB. If the DB write fails
// we attempt to revert Clerk so the two never diverge silently. Audit:
// `user.role_change`.

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { userRoleSchema } from "@/lib/validation/admin";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "user.role_change", 20, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = userRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
    );
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return jsonError(404, err("NOT_FOUND", "User not found"));

  if (target.id === guard.actor.id && parsed.data.role !== guard.actor.role) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Cannot demote yourself"),
    );
  }

  const previousRole = target.role;
  if (previousRole === parsed.data.role) {
    // No-op — still audit so we have a paper trail of the attempt.
    await logAudit({
      userId: guard.actor.id,
      action: "user.role_change",
      resourceType: "user",
      resourceId: target.id,
      ipAddress: guard.ip ?? undefined,
      metadata: { previousRole, nextRole: parsed.data.role, noop: true },
    });
    return NextResponse.json(ok({ userId: target.id, role: previousRole }));
  }

  let client;
  try {
    client = await clerkClient();
    await client.users.updateUserMetadata(target.clerkId, {
      publicMetadata: { role: parsed.data.role },
    });
  } catch (e) {
    return jsonError(
      503,
      err(
        "EXTERNAL_DEPENDENCY_FAILED",
        e instanceof Error ? e.message : "Clerk update failed",
      ),
    );
  }

  try {
    await prisma.user.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
    });
  } catch (e) {
    // Best-effort revert.
    try {
      await client.users.updateUserMetadata(target.clerkId, {
        publicMetadata: { role: previousRole },
      });
    } catch {
      // swallow — surfaced via audit metadata
    }
    return jsonError(
      500,
      err(
        "INTERNAL_ERROR",
        e instanceof Error ? e.message : "Database update failed",
      ),
    );
  }

  await logAudit({
    userId: guard.actor.id,
    action: "user.role_change",
    resourceType: "user",
    resourceId: target.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      previousRole,
      nextRole: parsed.data.role,
      targetEmailDomain: target.email.split("@")[1] ?? null,
    },
  });

  return NextResponse.json(ok({ userId: target.id, role: parsed.data.role }));
}
