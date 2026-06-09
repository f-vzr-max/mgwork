// /api/applications/[id]/accept
//
//   POST — CANDIDATE → accept a shortlist they received, consenting to reveal
//          their identity to the owning enterprise. Allowed ONLY when the
//          application belongs to the signed-in candidate AND is currently
//          SHORTLISTED. Sets status -> ACCEPTED (decision G consent gate; this
//          is the threshold at which the owning enterprise may see full PII).
//
// Auth: the candidate is resolved from the Clerk session; ownership + state are
// enforced DB-side in a single `updateMany` (id + candidateId + SHORTLISTED), so
// a cross-candidate id or an already-actioned row writes nothing and leaks no
// existence signal.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { err, ok, type ApiResponse } from "@/types/api";

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function jsonError(body: ApiResponse<unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // CSRF defense-in-depth.
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return jsonError(err("FORBIDDEN", e.message), 403);
    }
    throw e;
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }

  const allowed = await rateLimit(clerkUserId, "application.accept", 30, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests, slow down"), 429);
  }

  // Candidate is ALWAYS taken from the session — never from the request.
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { role: true, candidate: { select: { id: true } } },
  });
  if (!user) {
    return jsonError(err("UNAUTHORIZED", "User not synced yet"), 401);
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return jsonError(err("FORBIDDEN", "Only candidates can accept a shortlist"), 403);
  }

  const applicationId = params.id;

  // Ownership + state enforced atomically: only a SHORTLISTED row owned by THIS
  // candidate is advanced to ACCEPTED. count === 0 means not theirs, missing, or
  // already actioned — we do not distinguish (no existence/state probing).
  const result = await prisma.application.updateMany({
    where: {
      id: applicationId,
      candidateId: user.candidate.id,
      status: "SHORTLISTED",
    },
    data: { status: "ACCEPTED" },
  });

  if (result.count === 0) {
    return jsonError(
      err(
        "CONFLICT",
        "This shortlist can't be accepted (not found, not yours, or already actioned)",
      ),
      409,
    );
  }

  await logAuditByClerkId(clerkUserId, {
    action: "application.accept",
    resourceType: "application",
    resourceId: applicationId,
    ipAddress: getIp(req) ?? undefined,
    metadata: { status: "ACCEPTED" },
  });

  return NextResponse.json(
    ok({ applicationId, status: "ACCEPTED" }),
    { status: 200 },
  );
}
