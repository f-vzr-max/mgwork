// MG Work — Job offer detail endpoint (M5).
//
// GET    /api/offers/[id]  — owner ENTERPRISE | ADMIN | SUPER_ADMIN
// PATCH  /api/offers/[id]  — owner ENTERPRISE | ADMIN | SUPER_ADMIN
// DELETE /api/offers/[id]  — owner ENTERPRISE | ADMIN | SUPER_ADMIN
//
// Contract: docs/contracts.md §M5. Ownership is resolved server-side from the
// session; clients never claim an enterpriseId.
//
// Notes:
//   - PATCH respects the freemium gate when transitioning DRAFT → ACTIVE.
//   - DELETE is a hard delete — Matching/Application/Interview rows that point
//     to this offer cascade-delete in a single transaction. We pass on the
//     Application records' downstream rows (Interview/Checkpoint/CheckinPing)
//     because contracts mark this DELETE as available, and the FK constraints
//     would otherwise block the delete. Audit is written first.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { jobOfferUpdateSchema } from "@/lib/validation/job-offer";
import { canCreateOffer } from "@/lib/billing";
import { err, ok } from "@/types/api";

type Ctx = { params: { id: string } };

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

type LoadResult =
  | {
      ok: true;
      user: {
        id: string;
        role: string;
        enterprise: { id: string } | null;
      };
      offer: {
        id: string;
        enterpriseId: string;
        title: string;
        description: string;
        sector: string;
        location: string;
        slots: number;
        status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
        requirements: string[];
        langRequired: string[];
        createdAt: Date;
        updatedAt: Date;
      };
      isAdmin: boolean;
      isOwner: boolean;
    }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" };

async function loadActorAndOffer(clerkId: string, offerId: string): Promise<LoadResult> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      enterprise: { select: { id: true } },
    },
  });
  if (!user) return { ok: false, code: "NOT_FOUND" };
  const offer = await prisma.jobOffer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      enterpriseId: true,
      title: true,
      description: true,
      sector: true,
      location: true,
      slots: true,
      status: true,
      requirements: true,
      langRequired: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!offer) return { ok: false, code: "NOT_FOUND" };

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isOwner = user.enterprise?.id === offer.enterpriseId;
  if (!isAdmin && !isOwner) return { ok: false, code: "FORBIDDEN" };
  return { ok: true, user, offer, isAdmin, isOwner };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });

  const r = await loadActorAndOffer(clerkId, params.id);
  if (!r.ok) {
    return NextResponse.json(
      err(r.code, r.code === "FORBIDDEN" ? "Not your offer" : "Offer not found"),
      { status: r.code === "FORBIDDEN" ? 403 : 404 },
    );
  }
  return NextResponse.json(ok(r.offer));
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });

  const allowed = await rateLimit(clerkId, "offer.update", 20, 60);
  if (!allowed) return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  let parsed;
  try {
    parsed = jobOfferUpdateSchema.parse(body);
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

  const r = await loadActorAndOffer(clerkId, params.id);
  if (!r.ok) {
    return NextResponse.json(
      err(r.code, r.code === "FORBIDDEN" ? "Not your offer" : "Offer not found"),
      { status: r.code === "FORBIDDEN" ? 403 : 404 },
    );
  }

  // Freemium gate on DRAFT/PAUSED → ACTIVE transition.
  if (
    parsed.status === "ACTIVE" &&
    r.offer.status !== "ACTIVE" &&
    r.user.enterprise?.id
  ) {
    const ok2 = await canCreateOffer(r.user.enterprise.id);
    if (!ok2) {
      return NextResponse.json(
        err("PLAN_LIMIT_REACHED", "Free plan allows up to 3 active offers — upgrade to add more."),
        { status: 403 },
      );
    }
  }

  await prisma.jobOffer.update({
    where: { id: params.id },
    data: parsed,
  });

  await logAuditByClerkId(clerkId, {
    action: "offer.update",
    resourceType: "job_offer",
    resourceId: params.id,
    ipAddress: getIp(req),
    metadata: { fields: Object.keys(parsed) },
  });

  return NextResponse.json(ok({ offerId: params.id }));
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });

  const allowed = await rateLimit(clerkId, "offer.delete", 5, 60);
  if (!allowed) return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });

  const r = await loadActorAndOffer(clerkId, params.id);
  if (!r.ok) {
    return NextResponse.json(
      err(r.code, r.code === "FORBIDDEN" ? "Not your offer" : "Offer not found"),
      { status: r.code === "FORBIDDEN" ? 403 : 404 },
    );
  }

  // Audit BEFORE the cascade so the entry survives even if the transaction
  // fails partway and we have to retry.
  await logAuditByClerkId(clerkId, {
    action: "offer.delete",
    resourceType: "job_offer",
    resourceId: params.id,
    ipAddress: getIp(req),
    metadata: { previousStatus: r.offer.status },
  });

  await prisma.$transaction(async (tx) => {
    const apps = await tx.application.findMany({
      where: { jobOfferId: params.id },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await tx.checkinPing.deleteMany({ where: { applicationId: { in: appIds } } });
      await tx.interview.deleteMany({ where: { applicationId: { in: appIds } } });
      await tx.checkpoint.deleteMany({ where: { applicationId: { in: appIds } } });
    }
    await tx.application.deleteMany({ where: { jobOfferId: params.id } });
    await tx.matching.deleteMany({ where: { jobOfferId: params.id } });
    await tx.jobOffer.delete({ where: { id: params.id } });
  });

  return NextResponse.json(ok({ deleted: true as const }));
}
