// MG Work — Single interview endpoint (M7).
//
// Contract: docs/contracts.md row "PATCH /api/interviews/[id]".
//   - Auth: ENTERPRISE (offer owner) | CANDIDATE (application owner) | ADMIN.
//   - Body: interviewUpdateSchema (strict zod).
//   - Audit: `interview.update`.
//   - Rate limit: 30/min per user.
//
// Note: candidates and enterprises see only their own notes column;
// the route enforces that separation in field-level write rules.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import type { Prisma } from "@prisma/client";
import type { AuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { interviewUpdateSchema } from "@/lib/validation/interview";
import { err, ok } from "@/types/api";

type Params = { params: { id: string } };

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function PATCH(req: Request, { params }: Params) {
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

  const allowed = await rateLimit(clerkId, "interview.update", 30, 60);
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
    parsed = interviewUpdateSchema.parse(body);
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

  const interview = await prisma.interview.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      application: {
        select: {
          candidateId: true,
          jobOffer: { select: { enterpriseId: true } },
        },
      },
    },
  });
  if (!interview) {
    return NextResponse.json(err("NOT_FOUND", "Interview not found"), {
      status: 404,
    });
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isOwningCandidate =
    user.role === "CANDIDATE" &&
    !!user.candidate &&
    interview.application.candidateId === user.candidate.id;
  const isOwningEnterprise =
    user.role === "ENTERPRISE" &&
    !!user.enterprise &&
    interview.application.jobOffer.enterpriseId === user.enterprise.id;

  if (!isAdmin && !isOwningCandidate && !isOwningEnterprise) {
    return NextResponse.json(err("FORBIDDEN", "Not a participant"), {
      status: 403,
    });
  }

  // Field-level write rules:
  //  - candidates can only update candidateNotes
  //  - enterprises can update enterpriseNotes, status, videoUrl, scheduledAt
  //  - admin can update everything
  const data: Prisma.InterviewUpdateInput = {};
  const audited: Record<string, string | boolean> = {};

  if (isAdmin || isOwningEnterprise) {
    if (parsed.status !== undefined) {
      data.status = parsed.status;
      audited.status = parsed.status;
    }
    if (parsed.videoUrl !== undefined) {
      data.videoUrl = parsed.videoUrl ?? null;
      audited.videoUrlChanged = true;
    }
    if (parsed.scheduledAt !== undefined) {
      data.scheduledAt = parsed.scheduledAt;
      audited.scheduledAt = parsed.scheduledAt.toISOString();
    }
    if (parsed.enterpriseNotes !== undefined) {
      data.enterpriseNotes = parsed.enterpriseNotes ?? null;
      audited.enterpriseNotesChanged = true;
    }
  }
  if (isAdmin || isOwningCandidate) {
    if (parsed.candidateNotes !== undefined) {
      data.candidateNotes = parsed.candidateNotes ?? null;
      audited.candidateNotesChanged = true;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(err("VALIDATION_ERROR", "Nothing to update"), {
      status: 400,
    });
  }

  const updated = await prisma.interview.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      applicationId: true,
      scheduledAt: true,
      type: true,
      videoUrl: true,
      status: true,
      enterpriseNotes: !isOwningCandidate,
      candidateNotes: !isOwningEnterprise,
      createdAt: true,
    },
  });

  // If interview marked complete, advance the application status.
  if (parsed.status === "COMPLETED") {
    await prisma.application.update({
      where: { id: updated.applicationId },
      data: { status: "INTERVIEW_DONE" },
    });
  }

  await logAuditByClerkId(clerkId, {
    action: "interview.update",
    resourceType: "interview",
    resourceId: updated.id,
    ipAddress: getIp(req),
    metadata: audited as unknown as AuditMetadata,
  });

  return NextResponse.json(ok(updated), { status: 200 });
}
