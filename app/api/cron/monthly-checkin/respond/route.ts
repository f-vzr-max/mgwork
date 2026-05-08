// MG Work — In-app candidate response to a monthly check-in (M7).
//
// Lets a CANDIDATE log a response to one of their CheckinPing rows from the
// in-app UI. Marks `respondedAt` and stores `response` text. The cron's alert
// logic then leaves the application alone next pass.
//
// Auth: signed-in CANDIDATE owning the application linked to the ping.
// Audit: `checkin.respond`.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { checkinRespondSchema } from "@/lib/validation/interview";
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

  const allowed = await rateLimit(clerkId, "checkin.respond", 10, 60);
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
    parsed = checkinRespondSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid response payload", { fieldErrors }),
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
    },
  });
  if (!user || !user.candidate) {
    return NextResponse.json(err("FORBIDDEN", "Candidate profile required"), {
      status: 403,
    });
  }
  if (user.role !== "CANDIDATE") {
    return NextResponse.json(err("FORBIDDEN", "Wrong role"), { status: 403 });
  }

  const ping = await prisma.checkinPing.findUnique({
    where: { id: parsed.checkinPingId },
    select: {
      id: true,
      respondedAt: true,
      application: { select: { candidateId: true } },
    },
  });
  if (!ping) {
    return NextResponse.json(err("NOT_FOUND", "Check-in not found"), {
      status: 404,
    });
  }
  if (ping.application.candidateId !== user.candidate.id) {
    return NextResponse.json(err("FORBIDDEN", "Not your check-in"), {
      status: 403,
    });
  }
  if (ping.respondedAt) {
    return NextResponse.json(err("CONFLICT", "Already responded"), {
      status: 409,
    });
  }

  await prisma.checkinPing.update({
    where: { id: ping.id },
    data: {
      respondedAt: new Date(),
      response: parsed.response,
    },
  });

  await logAuditByClerkId(clerkId, {
    action: "checkin.respond",
    resourceType: "checkin_ping",
    resourceId: ping.id,
    ipAddress: getIp(req),
    metadata: { length: parsed.response.length },
  });

  return NextResponse.json(ok({ saved: true }), { status: 200 });
}
