// POST /api/staff/checkpoints
//
// Creates a Checkpoint row for an Application. Body:
//   { applicationId: cuid, status: CheckpointStatus, notes?, interventionLog? }
//
// Auth: STAFF_FOLLOWUP, ADMIN, SUPER_ADMIN.
// Audit key: `checkpoint.create`.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { checkpointCreateSchema } from "@/lib/validation/staff";
import { requireStaffActor, getRequestIp } from "@/lib/staff-auth";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const { userId: clerkId } = await auth();
  const guard = await requireStaffActor(clerkId, ["STAFF_FOLLOWUP"]);
  if (!guard.ok) return guard.response;
  const { actor } = guard;

  if (!(await rateLimit(actor.id, "checkpoint.create", 30, 60))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  const parsed = checkpointCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { applicationId, status, notes, interventionLog } = parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, candidateId: true },
  });
  if (!application) return new NextResponse("Not Found", { status: 404 });

  const created = await prisma.checkpoint.create({
    data: {
      applicationId: application.id,
      candidateId: application.candidateId,
      staffId: actor.id,
      status,
      ...(notes ? { notes } : {}),
      ...(interventionLog ? { interventionLog } : {}),
    },
    select: { id: true },
  });

  await logAudit({
    userId: actor.id,
    action: "checkpoint.create",
    resourceType: "checkpoint",
    resourceId: created.id,
    ipAddress: getRequestIp(req) ?? undefined,
    metadata: {
      applicationId: application.id,
      status,
    },
  });

  return NextResponse.json({ ok: true, data: { checkpointId: created.id } });
}
