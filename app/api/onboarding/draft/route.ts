// MG Work — Onboarding draft persistence.
//
// Cross-device draft store for the candidate / enterprise onboarding wizards.
// The draft is keyed by Clerk userId (one row per user, upsert on save) and
// holds the in-progress form data + last step index.
//
// Endpoints:
//   GET    /api/onboarding/draft  → { draft: { stepIndex, data, role } | null }
//   PUT    /api/onboarding/draft  → upsert { stepIndex, data }
//   DELETE /api/onboarding/draft  → remove (called after successful submit)
//
// Auth: signed-in user with role CANDIDATE or ENTERPRISE.
// CSRF: assertSameOrigin on PUT/DELETE.
// Rate limit: 30 / 60s per user (saves can fire on each step transition).
// Audit: not logged — drafts are routine save state, not security-relevant.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { err, ok } from "@/types/api";

// We keep the body shape permissive: the draft is mid-flow and may carry
// values that wouldn't pass the final candidate/enterprise schemas yet. We
// validate only the structural envelope here; the full schema parses on the
// final POST to /api/candidates or /api/enterprises.
const draftSchema = z
  .object({
    stepIndex: z.number().int().min(0).max(20).default(0),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

const MAX_DRAFT_BYTES = 32 * 1024; // sanity cap; full form is well under 4 KB

async function resolveUser(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const user = await resolveUser(clerkId);
  if (!user) return NextResponse.json(ok({ draft: null }));

  const draft = await prisma.onboardingDraft.findUnique({
    where: { userId: user.id },
    select: {
      stepIndex: true,
      data: true,
      role: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(ok({ draft }));
}

export async function PUT(req: Request) {
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
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "onboarding.draft", 30, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_DRAFT_BYTES) {
    return NextResponse.json(
      err("PAYLOAD_TOO_LARGE", "Draft too large"),
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), {
      status: 400,
    });
  }

  let parsed;
  try {
    parsed = draftSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid draft payload"),
        { status: 400 },
      );
    }
    throw e;
  }

  const user = await resolveUser(clerkId);
  if (!user) {
    return NextResponse.json(
      err("NOT_FOUND", "User profile not yet synced; retry shortly"),
      { status: 404 },
    );
  }
  if (user.role !== "CANDIDATE" && user.role !== "ENTERPRISE") {
    return NextResponse.json(
      err("FORBIDDEN", "Only candidate or enterprise users have onboarding drafts"),
      { status: 403 },
    );
  }

  const dataJson = parsed.data as Prisma.InputJsonValue;
  await prisma.onboardingDraft.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      role: user.role,
      stepIndex: parsed.stepIndex,
      data: dataJson,
    },
    update: {
      stepIndex: parsed.stepIndex,
      data: dataJson,
    },
  });

  return NextResponse.json(ok({ saved: true }));
}

export async function DELETE(req: Request) {
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
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const user = await resolveUser(clerkId);
  if (user) {
    await prisma.onboardingDraft.deleteMany({ where: { userId: user.id } });
  }

  return NextResponse.json(ok({ deleted: true }));
}
