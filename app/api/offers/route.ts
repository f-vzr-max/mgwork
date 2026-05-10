// MG Work — Job offer creation endpoint (M5).
//
// Contract: docs/contracts.md row "POST /api/offers".
//   - Auth: signed-in user with role ENTERPRISE who already has an Enterprise
//     row.
//   - Body: jobOfferCreateSchema (strict zod). Status defaults to DRAFT.
//   - Audit: offer.create
//   - Rate limit: 10 / 60s per Clerk userId.
//   - Freemium gate: if the offer is created (or transitioned to) ACTIVE and
//     the enterprise is on FREE plan, refuse with 403 PLAN_LIMIT_REACHED when
//     the cap (3 active offers) is already met.
//
// Server resolves the enterpriseId from the session — clients never specify
// which enterprise the offer belongs to.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { jobOfferCreateSchema } from "@/lib/validation/job-offer";
import { canCreateOffer } from "@/lib/billing";
import { err, ok } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "offer.create", 10, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  let parsed;
  try {
    parsed = jobOfferCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid offer payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), { status: 404 });
  }
  if (user.role !== "ENTERPRISE" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(err("FORBIDDEN", "Only enterprise users can post offers"), { status: 403 });
  }
  if (!user.enterprise) {
    return NextResponse.json(
      err("NOT_FOUND", "Enterprise profile required before posting offers"),
      { status: 404 },
    );
  }

  // Freemium gate. We only enforce it when the offer would land in ACTIVE.
  // DRAFTs don't count against the cap.
  if (parsed.status === "ACTIVE") {
    const ok2 = await canCreateOffer(user.enterprise.id);
    if (!ok2) {
      return NextResponse.json(
        err("PLAN_LIMIT_REACHED", "Free plan allows up to 3 active offers — upgrade to add more."),
        { status: 403 },
      );
    }
  }

  const created = await prisma.jobOffer.create({
    data: {
      enterpriseId: user.enterprise.id,
      title: parsed.title,
      description: parsed.description,
      sector: parsed.sector,
      location: parsed.location,
      slots: parsed.slots,
      status: parsed.status,
      requirements: parsed.requirements,
      langRequired: parsed.langRequired,
    },
    select: { id: true },
  });

  await logAuditByClerkId(clerkId, {
    action: "offer.create",
    resourceType: "job_offer",
    resourceId: created.id,
    ipAddress: getIp(req),
    metadata: {
      status: parsed.status,
      sector: parsed.sector,
      slots: parsed.slots,
      requirementCount: parsed.requirements.length,
    },
  });

  return NextResponse.json(ok({ offerId: created.id }), { status: 201 });
}
