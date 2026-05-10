// POST /api/staff/documents/[id]/reject
//
// Marks a Document as REJECTED with a reason. Reason is required and
// must be at least 10 chars after trimming (server-enforced — clients
// also enforce client-side).
// Audit key: `document.reject`.
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
import { documentRejectSchema } from "@/lib/validation/document";
import { requireStaffActor, getRequestIp } from "@/lib/staff-auth";

type Params = { params: { id: string } };

const MIN_REASON = 10;

export async function POST(req: Request, { params }: Params) {
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

  if (!(await rateLimit(actor.id, "document.reject", 30, 60))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  const parsed = documentRejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const reason = parsed.data.reason.trim();
  if (reason.length < MIN_REASON) {
    return NextResponse.json(
      { ok: false, error: `Reason must be at least ${MIN_REASON} characters.` },
      { status: 400 },
    );
  }

  const docId = params.id;
  const existing = await prisma.document.findUnique({
    where: { id: docId },
    select: { id: true, status: true, type: true },
  });
  if (!existing) return new NextResponse("Not Found", { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: `Document is ${existing.status.toLowerCase()}, cannot reject.` },
      { status: 409 },
    );
  }

  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      status: "REJECTED",
      rejectionNote: reason,
      verifiedAt: new Date(),
      verifiedById: actor.id,
    },
  });

  await logAudit({
    userId: actor.id,
    action: "document.reject",
    resourceType: "document",
    resourceId: updated.id,
    ipAddress: getRequestIp(req) ?? undefined,
    // Reason can be long. Audit row will keep the full text — this is
    // intentional for staff-action accountability.
    metadata: {
      type: updated.type,
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: updated.id,
      status: updated.status,
      rejectionNote: updated.rejectionNote,
      verifiedAt: updated.verifiedAt,
      verifiedById: updated.verifiedById,
    },
  });
}
