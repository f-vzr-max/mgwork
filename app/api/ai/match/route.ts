// MG Work — AI matching trigger (M5).
//
// POST /api/ai/match  body: { offerId }
//   - Auth: ENTERPRISE (offer owner) | ADMIN | SUPER_ADMIN
//   - Rate limit: 5 / 60s per Clerk userId. Recompute is heavy enough that we
//     don't want it run on every keystroke; UI should debounce + the server
//     enforces a hard floor.
//   - Audit: matching.recompute
//
// Implementation:
//   - Reads the active matching weights from MatchingConfig (singleton).
//   - Calls `recomputeMatchings(offerId, weights)` from lib/matching.ts which
//     wipes + reinserts up to 5 Matching rows for the offer.
//   - The recompute itself is purely scoring math (lib/scoring.ts). It does
//     not call Claude — we keep the AI route name for parity with contracts.md
//     and to leave room for a future reranker without breaking clients.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { aiMatchSchema } from "@/lib/validation/ai";
import { recomputeMatchings } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
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

  const allowed = await rateLimit(clerkId, "matching.recompute", 5, 60);
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
    parsed = aiMatchSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid match payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  // Authorize: actor must be ADMIN or own the offer's enterprise.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), { status: 404 });
  }

  const offer = await prisma.jobOffer.findUnique({
    where: { id: parsed.offerId },
    select: { id: true, enterpriseId: true },
  });
  if (!offer) {
    return NextResponse.json(err("NOT_FOUND", "Offer not found"), { status: 404 });
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isOwner = user.enterprise?.id === offer.enterpriseId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json(err("FORBIDDEN", "Not your offer"), { status: 403 });
  }

  const weights = await getMatchingWeights();
  const top = await recomputeMatchings(offer.id, weights);

  await logAuditByClerkId(clerkId, {
    action: "matching.recompute",
    resourceType: "job_offer",
    resourceId: offer.id,
    ipAddress: getIp(req),
    metadata: {
      count: top.length,
      bestScore: top[0]?.score ?? 0,
    },
  });

  return NextResponse.json(ok({ count: top.length }));
}
