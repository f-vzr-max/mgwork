// POST /api/staff/documents/[id]/approve
//
// Marks a Document as APPROVED. Sets verifiedAt to now and
// verifiedById to the staff member's INTERNAL User.id (not the Clerk id).
// Audit key: `document.approve`.
//
// Auth: STAFF_DOCUMENTS, ADMIN, SUPER_ADMIN.
// CSRF: Origin/Referer must match app origins.
// Rate limit: 30 actions / 60s per staff user.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { documentApproveSchema } from "@/lib/validation/document";
import { requireStaffActor, getRequestIp } from "@/lib/staff-auth";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  // CSRF
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const { userId: clerkId } = await auth();
  const guard = await requireStaffActor(clerkId, ["STAFF_DOCUMENTS"]);
  if (!guard.ok) return guard.response;
  const { actor } = guard;

  if (!(await rateLimit(actor.id, "document.approve", 30, 60))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  // Body is optional but if present must validate (allows future "note" field).
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) body = JSON.parse(text);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  const parsed = documentApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const docId = params.id;
  const existing = await prisma.document.findUnique({
    where: { id: docId },
    select: { id: true, status: true },
  });
  if (!existing) return new NextResponse("Not Found", { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: `Document is ${existing.status.toLowerCase()}, cannot approve.` },
      { status: 409 },
    );
  }

  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      status: "APPROVED",
      verifiedAt: new Date(),
      verifiedById: actor.id,
      // Clear any prior rejection note in case of re-review.
      rejectionNote: null,
    },
  });

  await logAudit({
    userId: actor.id,
    action: "document.approve",
    resourceType: "document",
    resourceId: updated.id,
    ipAddress: getRequestIp(req) ?? undefined,
    metadata: {
      type: updated.type,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: updated.id,
      status: updated.status,
      verifiedAt: updated.verifiedAt,
      verifiedById: updated.verifiedById,
    },
  });
}
