// MG Work — Candidate creation endpoint (M2 onboarding).
//
// Contract: docs/contracts.md row "POST /api/candidates".
//   - Auth: signed-in user with role CANDIDATE who does not yet have a
//     Candidate row.
//   - Body: candidateCreateSchema (strict zod).
//   - Audit: candidate.create
//   - Rate limit: 5 / 60s per Clerk userId.
//
// Response envelope: ApiResponse<{ candidateId: Id }> (types/api.ts).
//
// Notes:
//   - We resolve the role from the User row (DB) rather than session claims so
//     a stale JWT can't promote/demote anyone. The Clerk webhook is the source
//     of truth for User.role.
//   - We never log raw request bodies — the audit metadata records only field
//     presence flags.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { candidateCreateSchema } from "@/lib/validation/candidate";
import { err, ok } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: Request) {
  // 1) CSRF — Origin / Referer check.
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  // 2) Clerk session.
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  // 3) Rate limit (5 per minute per user).
  const allowed = await rateLimit(clerkId, "candidate.create", 5, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  // 4) Parse body with strict zod schema.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), {
      status: 400,
    });
  }

  let parsed;
  try {
    parsed = candidateCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid candidate payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  // 5) Look up User row (synced via Clerk webhook).
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json(
      err("NOT_FOUND", "User profile not yet synced; retry shortly"),
      { status: 404 },
    );
  }
  if (user.role !== "CANDIDATE") {
    return NextResponse.json(
      err("FORBIDDEN", "Only CANDIDATE users can create a candidate profile"),
      { status: 403 },
    );
  }

  // 6) Create Candidate row. Unique constraint on Candidate.userId enforces
  // one-per-user — turn the Prisma P2002 into a clean 409.
  let createdId: string;
  try {
    const created = await prisma.candidate.create({
      data: {
        userId: user.id,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        dateOfBirth: parsed.dateOfBirth,
        nationality: parsed.nationality,
        phone: parsed.phone,
        city: parsed.city,
        bio: parsed.bio,
        skills: parsed.skills,
        sectors: parsed.sectors,
        langScoreFR: parsed.langScoreFR,
        langScoreEN: parsed.langScoreEN,
        cvFileUrl: parsed.cvFileUrl,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        err("CONFLICT", "Candidate profile already exists"),
        { status: 409 },
      );
    }
    throw e;
  }

  // 7) Audit. Best-effort; never blocks success. We already have user.id so we
  // call logAudit directly rather than re-resolving from the Clerk ID.
  await logAudit({
    userId: user.id,
    action: "candidate.create",
    resourceType: "candidate",
    resourceId: createdId,
    ipAddress: getIp(req),
    metadata: {
      hasCv: !!parsed.cvFileUrl,
      skillCount: parsed.skills.length,
      sectorCount: parsed.sectors.length,
    },
  });

  return NextResponse.json(ok({ candidateId: createdId }), { status: 201 });
}
