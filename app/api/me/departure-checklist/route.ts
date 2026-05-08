// MG Work — Candidate departure-checklist endpoint (M7).
//
// PATCH only. Stores a JSON blob (`Candidate.departureChecklist`) tracking the
// candidate's pre-departure tasks: flight, housing, emergency contact, packing.
//
// Auth: signed-in CANDIDATE (owner only). Role + ownership are derived from
// the DB User row, not session claims.
// Audit: `candidate.departure_checklist_update`.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { departureChecklistUpdateSchema } from "@/lib/validation/interview";
import { err, ok } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function PATCH(req: Request) {
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

  const allowed = await rateLimit(clerkId, "checklist.update", 30, 60);
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
    parsed = departureChecklistUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid checklist payload", { fieldErrors }),
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
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), {
      status: 404,
    });
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return NextResponse.json(
      err("FORBIDDEN", "Only candidates may update their checklist"),
      { status: 403 },
    );
  }

  await prisma.candidate.update({
    where: { id: user.candidate.id },
    data: { departureChecklist: parsed.checklist },
  });

  // Build a small, PII-light audit summary.
  const summary = {
    flightBooked: parsed.checklist.flight?.booked ?? false,
    housingConfirmed: parsed.checklist.housing?.confirmed ?? false,
    hasEmergencyContact: !!parsed.checklist.emergency?.contactName,
    packingItemCount: parsed.checklist.packing?.items.length ?? 0,
    packingItemsDone:
      parsed.checklist.packing?.items.filter((i) => i.done).length ?? 0,
  };

  await logAuditByClerkId(clerkId, {
    action: "candidate.departure_checklist_update",
    resourceType: "candidate",
    resourceId: user.candidate.id,
    ipAddress: getIp(req),
    metadata: summary,
  });

  return NextResponse.json(ok({ saved: true }), { status: 200 });
}
