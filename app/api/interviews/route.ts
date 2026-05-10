// MG Work — Interviews collection endpoint (M7).
//
// Contract: docs/contracts.md rows "POST /api/interviews" + "GET /api/interviews".
//   - POST: ENTERPRISE owning the application's offer OR ADMIN.
//   - GET:  ENTERPRISE | CANDIDATE | ADMIN — scoped to caller's interviews.
//   - Body (POST): interviewCreateSchema (strict zod).
//   - Audit: `interview.schedule` (POST), `interview.list` is read-only — no audit.
//   - Rate limit: 10/min writes, 60/min reads per user.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { interviewCreateSchema } from "@/lib/validation/interview";
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

  const allowed = await rateLimit(clerkId, "interview.create", 10, 60);
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
    parsed = interviewCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid interview payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  // Resolve actor + role from DB (not session claims) for trust.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), {
      status: 404,
    });
  }
  if (
    user.role !== "ENTERPRISE" &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json(
      err("FORBIDDEN", "Only ENTERPRISE or ADMIN may schedule interviews"),
      { status: 403 },
    );
  }

  // Look up the application and verify ENTERPRISE ownership of the offer.
  const application = await prisma.application.findUnique({
    where: { id: parsed.applicationId },
    select: {
      id: true,
      jobOffer: {
        select: {
          enterprise: { select: { userId: true } },
        },
      },
    },
  });
  if (!application) {
    return NextResponse.json(err("NOT_FOUND", "Application not found"), {
      status: 404,
    });
  }

  if (user.role === "ENTERPRISE") {
    if (application.jobOffer.enterprise.userId !== user.id) {
      return NextResponse.json(
        err("FORBIDDEN", "You do not own this offer"),
        { status: 403 },
      );
    }
  }

  const created = await prisma.interview.create({
    data: {
      applicationId: parsed.applicationId,
      scheduledAt: parsed.scheduledAt,
      type: parsed.type,
      videoUrl: parsed.videoUrl,
    },
    select: { id: true },
  });

  // Bump the Application status when relevant.
  await prisma.application.update({
    where: { id: parsed.applicationId },
    data: { status: "INTERVIEW_SCHEDULED" },
  });

  await logAuditByClerkId(clerkId, {
    action: "interview.schedule",
    resourceType: "interview",
    resourceId: created.id,
    ipAddress: getIp(req),
    metadata: {
      applicationId: parsed.applicationId,
      type: parsed.type,
      hasVideoUrl: !!parsed.videoUrl,
    },
  });

  return NextResponse.json(ok({ interviewId: created.id }), { status: 201 });
}

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "interview.list", 60, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // YYYY-MM
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
    200,
  );

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      candidate: { select: { id: true } },
      enterprise: { select: { id: true } },
    },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), {
      status: 404,
    });
  }

  // Build per-role visibility filter.
  let where:
    | {
        application?: {
          candidateId?: string;
          jobOffer?: { enterpriseId: string };
        };
      }
    | undefined;

  if (user.role === "CANDIDATE") {
    if (!user.candidate) {
      return NextResponse.json(
        ok({ items: [] as const, nextCursor: null, total: 0 }),
        { status: 200 },
      );
    }
    where = { application: { candidateId: user.candidate.id } };
  } else if (user.role === "ENTERPRISE") {
    if (!user.enterprise) {
      return NextResponse.json(
        ok({ items: [] as const, nextCursor: null, total: 0 }),
        { status: 200 },
      );
    }
    where = {
      application: { jobOffer: { enterpriseId: user.enterprise.id } },
    };
  } else if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    where = undefined;
  } else {
    return NextResponse.json(err("FORBIDDEN", "No access"), { status: 403 });
  }

  // Optional month filter (YYYY-MM).
  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [yStr, mStr] = monthParam.split("-");
    const y = Number.parseInt(yStr, 10);
    const m = Number.parseInt(mStr, 10);
    if (m >= 1 && m <= 12) {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      dateFilter = { gte: start, lt: end };
    }
  }

  const items = await prisma.interview.findMany({
    where: {
      ...(where ?? {}),
      ...(dateFilter ? { scheduledAt: dateFilter } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      applicationId: true,
      scheduledAt: true,
      type: true,
      videoUrl: true,
      status: true,
      enterpriseNotes: user.role !== "CANDIDATE",
      candidateNotes: user.role !== "ENTERPRISE",
      createdAt: true,
      application: {
        select: {
          candidate: {
            select: { id: true, firstName: true, lastName: true },
          },
          jobOffer: {
            select: { id: true, title: true, enterpriseId: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    ok({ items, nextCursor: null, total: items.length }),
    { status: 200 },
  );
}
