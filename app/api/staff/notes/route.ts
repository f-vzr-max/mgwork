// POST /api/staff/notes
//
// Creates a private StaffNote attached to an arbitrary resource.
// Body: { resourceType, resourceId, note }.
//
// Auth: STAFF_FOLLOWUP | STAFF_DOCUMENTS | ADMIN | SUPER_ADMIN.
// Audit key: `staff_note.create`.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { staffNoteCreateSchema } from "@/lib/validation/staff";
import { requireStaffActor, getRequestIp } from "@/lib/staff-auth";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  // Both staff teams may attach notes — the union covers all four roles
  // (STAFF_FOLLOWUP, STAFF_DOCUMENTS, ADMIN, SUPER_ADMIN). ADMIN_ROLES are
  // appended automatically inside requireStaffActor.
  const { userId: clerkId } = await auth();
  const guard = await requireStaffActor(clerkId, ["STAFF_FOLLOWUP", "STAFF_DOCUMENTS"]);
  if (!guard.ok) return guard.response;
  const { actor } = guard;

  if (!(await rateLimit(actor.id, "staff_note.create", 30, 60))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  const parsed = staffNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { resourceType, resourceId, note } = parsed.data;

  // Validate that the referenced resource actually exists. This avoids
  // dangling notes pointing at typo'd IDs.
  const exists = await resourceExists(resourceType, resourceId);
  if (!exists) return new NextResponse("Resource not found", { status: 404 });

  const created = await prisma.staffNote.create({
    data: {
      staffId: actor.id,
      resourceType,
      resourceId,
      note,
    },
    select: { id: true },
  });

  await logAudit({
    userId: actor.id,
    action: "staff_note.create",
    resourceType: "staff_note",
    resourceId: created.id,
    ipAddress: getRequestIp(req) ?? undefined,
    metadata: { resourceType, resourceId },
  });

  return NextResponse.json({ ok: true, data: { noteId: created.id } });
}

async function resourceExists(resourceType: string, resourceId: string): Promise<boolean> {
  switch (resourceType) {
    case "candidate": {
      const r = await prisma.candidate.findUnique({ where: { id: resourceId }, select: { id: true } });
      return Boolean(r);
    }
    case "enterprise": {
      const r = await prisma.enterprise.findUnique({ where: { id: resourceId }, select: { id: true } });
      return Boolean(r);
    }
    case "application": {
      const r = await prisma.application.findUnique({ where: { id: resourceId }, select: { id: true } });
      return Boolean(r);
    }
    case "document": {
      const r = await prisma.document.findUnique({ where: { id: resourceId }, select: { id: true } });
      return Boolean(r);
    }
    case "checkpoint": {
      const r = await prisma.checkpoint.findUnique({ where: { id: resourceId }, select: { id: true } });
      return Boolean(r);
    }
    default:
      return false;
  }
}
