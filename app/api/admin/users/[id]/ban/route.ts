// POST /api/admin/users/[id]/ban
//
// Sets Clerk publicMetadata.banned = true|false on the target user. We do NOT
// add a `banned` column to the Prisma User model — Clerk metadata is the source
// of truth so a single revoke also blocks login (the next time middleware
// reads session claims, the gate can refuse). Audit: `user.ban`.

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { userBanSchema } from "@/lib/validation/admin";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "user.ban", 30, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = userBanSchema.safeParse(body);
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

  // Refuse to ban another admin unless the actor is SUPER_ADMIN — same defense
  // as the erasure route.
  if (
    (target.role === "ADMIN" || target.role === "SUPER_ADMIN") &&
    guard.actor.role !== "SUPER_ADMIN"
  ) {
    return jsonError(
      403,
      err("FORBIDDEN", "Only SUPER_ADMIN can ban another admin"),
    );
  }

  // Don't let an actor ban themselves.
  if (target.id === guard.actor.id) {
    return jsonError(400, err("VALIDATION_ERROR", "Cannot ban yourself"));
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(target.clerkId, {
      publicMetadata: { banned: parsed.data.banned },
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

  await logAudit({
    userId: guard.actor.id,
    action: "user.ban",
    resourceType: "user",
    resourceId: target.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      banned: parsed.data.banned,
      reason: parsed.data.reason ?? null,
      targetRole: target.role,
      targetEmailDomain: target.email.split("@")[1] ?? null,
    },
  });

  return NextResponse.json(ok({ userId: target.id, banned: parsed.data.banned }));
}
