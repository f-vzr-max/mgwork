// MG Work — Enterprise creation endpoint (M2 onboarding).
//
// Contract: docs/contracts.md row "POST /api/enterprises".
//   - Auth: signed-in user with role ENTERPRISE who does not yet have an
//     Enterprise row.
//   - Body: enterpriseCreateSchema (strict zod).
//   - Audit: enterprise.create
//   - Rate limit: 5 / 60s per Clerk userId.
//
// Mirrors app/api/candidates/route.ts; see that file for design notes.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { enterpriseCreateSchema } from "@/lib/validation/enterprise";
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
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "enterprise.create", 5, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

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
    parsed = enterpriseCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid enterprise payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

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
  if (user.role !== "ENTERPRISE") {
    return NextResponse.json(
      err("FORBIDDEN", "Only ENTERPRISE users can create an enterprise profile"),
      { status: 403 },
    );
  }

  let createdId: string;
  try {
    const created = await prisma.enterprise.create({
      data: {
        userId: user.id,
        companyName: parsed.companyName,
        registrationNumber: parsed.registrationNumber,
        sector: parsed.sector,
        address: parsed.address,
        contactName: parsed.contactName,
        contactPhone: parsed.contactPhone,
        plan: parsed.plan,
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
        err("CONFLICT", "Enterprise profile already exists"),
        { status: 409 },
      );
    }
    throw e;
  }

  await logAudit({
    userId: user.id,
    action: "enterprise.create",
    resourceType: "enterprise",
    resourceId: createdId,
    ipAddress: getIp(req),
    metadata: {
      plan: parsed.plan,
      hasRegistrationNumber: !!parsed.registrationNumber,
    },
  });

  return NextResponse.json(ok({ enterpriseId: createdId }), { status: 201 });
}
