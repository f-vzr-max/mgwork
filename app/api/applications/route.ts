// /api/applications
//
//   POST  — ENTERPRISE  → proactively shortlist or pass a candidate against one
//           of the enterprise's own ACTIVE job offers.
//
// Auth: the owning Enterprise is resolved from the Clerk session, never from
// the body. The requesting enterprise MUST own `jobOfferId` and the offer MUST
// be ACTIVE — a cross-enterprise jobOfferId is rejected 403.
//
// This UPSERTs the Application on the compound unique ([candidateId, jobOfferId]):
// no Application row may exist yet for a proactive shortlist, so PATCH is wrong.
//   shortlist -> status SHORTLISTED
//   pass      -> status REJECTED
//
// Audit: `application.shortlist` / `application.pass` on success.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { err, ok, type ApiResponse } from "@/types/api";

const CUID = z.string().trim().min(1).max(64);

const bodySchema = z
  .object({
    candidateId: CUID,
    jobOfferId: CUID,
    action: z.enum(["shortlist", "pass"]),
  })
  .strict();

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function jsonError(body: ApiResponse<unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF defense-in-depth before reading the body.
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

  const allowed = await rateLimit(clerkUserId, "application.upsert", 30, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests, slow down"), 429);
  }

  // Resolve the internal User row + their Enterprise profile. The enterprise is
  // ALWAYS taken from the session — never from the request body.
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) {
    return jsonError(err("UNAUTHORIZED", "User not synced yet"), 401);
  }
  if (user.role !== "ENTERPRISE" || !user.enterprise) {
    return jsonError(err("FORBIDDEN", "Only enterprises can shortlist candidates"), 403);
  }
  const enterpriseId = user.enterprise.id;

  // Validate body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(err("VALIDATION_ERROR", "Invalid JSON body"), 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "_";
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return jsonError(
      err("VALIDATION_ERROR", "Invalid request body", { fieldErrors }),
      400,
    );
  }
  const { candidateId, jobOfferId, action } = parsed.data;

  // AUTHZ: the offer must exist, be owned by THIS enterprise, and be ACTIVE.
  const offer = await prisma.jobOffer.findUnique({
    where: { id: jobOfferId },
    select: { id: true, enterpriseId: true, status: true },
  });
  if (!offer || offer.enterpriseId !== enterpriseId) {
    // Do not distinguish "not found" from "not yours" — avoid offer-id probing.
    return jsonError(err("FORBIDDEN", "Offer not found or not owned by you"), 403);
  }
  if (offer.status !== "ACTIVE") {
    return jsonError(
      err("CONFLICT", "Offer must be ACTIVE to shortlist or pass candidates"),
      409,
    );
  }

  // The candidate must exist before we link an Application to them.
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true },
  });
  if (!candidate) {
    return jsonError(err("NOT_FOUND", "Candidate not found"), 404);
  }

  const nextStatus = action === "shortlist" ? "SHORTLISTED" : "REJECTED";

  // UPSERT on the compound unique — a proactive shortlist has no prior row.
  const application = await prisma.application.upsert({
    where: { candidateId_jobOfferId: { candidateId, jobOfferId } },
    create: { candidateId, jobOfferId, status: nextStatus },
    update: { status: nextStatus },
    select: { id: true, status: true },
  });

  await logAuditByClerkId(clerkUserId, {
    action: action === "shortlist" ? "application.shortlist" : "application.pass",
    resourceType: "application",
    resourceId: application.id,
    ipAddress: getIp(req) ?? undefined,
    metadata: { candidateId, jobOfferId, status: application.status },
  });

  return NextResponse.json(
    ok({ applicationId: application.id, status: application.status }),
    { status: 200 },
  );
}
