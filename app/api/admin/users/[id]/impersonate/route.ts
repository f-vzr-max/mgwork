// POST /api/admin/users/[id]/impersonate
//
// Creates a Clerk Actor Token for the target user and returns the URL the
// admin should follow to start the impersonation session. The token is a
// short-lived one-time-use credential (default 1h life, 30min session).
//
// Auth: ADMIN or SUPER_ADMIN. Targeting another admin requires SUPER_ADMIN.
// Audit: `user.impersonate`.
//
// If Clerk SDK is misconfigured (env missing) we return 503 — UI handles that
// gracefully (button shows the error toast).

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "user.impersonate", 10, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return jsonError(404, err("NOT_FOUND", "User not found"));

  if (
    (target.role === "ADMIN" || target.role === "SUPER_ADMIN") &&
    guard.actor.role !== "SUPER_ADMIN"
  ) {
    return jsonError(
      403,
      err("FORBIDDEN", "Only SUPER_ADMIN can impersonate another admin"),
    );
  }

  let url: string | null = null;
  try {
    const client = await clerkClient();
    const token = await client.actorTokens.create({
      userId: target.clerkId,
      actor: { sub: guard.actor.clerkId },
      expiresInSeconds: 60 * 30,
      sessionMaxDurationInSeconds: 60 * 30,
    });
    // The SDK returns either `token.url` (hosted sign-in URL) or just the
    // token. Prefer the URL when available.
    url = token.url ?? null;
    if (!url && token.token) {
      // Fallback — caller must paste the token into a sign-in URL.
      url = `clerk://actor-token?token=${encodeURIComponent(token.token)}`;
    }
  } catch (e) {
    return jsonError(
      503,
      err(
        "EXTERNAL_DEPENDENCY_FAILED",
        e instanceof Error ? e.message : "Clerk impersonation unavailable",
      ),
    );
  }

  if (!url) {
    return jsonError(
      503,
      err("EXTERNAL_DEPENDENCY_FAILED", "Clerk did not return an impersonation URL"),
    );
  }

  await logAudit({
    userId: guard.actor.id,
    action: "user.impersonate",
    resourceType: "user",
    resourceId: target.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      targetRole: target.role,
      targetEmailDomain: target.email.split("@")[1] ?? null,
    },
  });

  return NextResponse.json(ok({ userId: target.id, url }));
}
