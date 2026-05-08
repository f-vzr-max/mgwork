// /api/documents/[id]
//
//   GET    — owner | STAFF_DOCUMENTS | ADMIN | SUPER_ADMIN  → DocumentDto (no fileUrl)
//   PATCH  — STAFF_DOCUMENTS | ADMIN                        → DocumentDto
//   DELETE — owner (soft via REJECTED) | SUPER_ADMIN (hard) → { deleted: true }
//
// We never expose the raw `fileUrl` from this route. Clients that need to
// view the file call /api/documents/[id]/signed-url and get a 15-min URL.
//
// Audit keys: document.read | document.update | document.delete.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  parseStorageRef,
  toDocumentDto,
  type DocumentDto,
} from "@/lib/documents";
import { documentPatchSchema } from "@/lib/validation/document";
import { err, ok, type ApiResponse } from "@/types/api";

type RouteCtx = { params: { id: string } };

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function jsonError(body: ApiResponse<unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

type LoadActorAndDocResult =
  | { kind: "error"; response: NextResponse }
  | {
      kind: "ok";
      actor: NonNullable<
        Awaited<
          ReturnType<
            typeof prisma.user.findUnique<{
              where: { clerkId: string };
              include: { candidate: true; enterprise: true };
            }>
          >
        >
      >;
      doc: NonNullable<Awaited<ReturnType<typeof prisma.document.findUnique>>>;
      ip: string | null;
    };

// Resolve the actor + the target document in one go. Caller supplies
// `clerkUserId` so each handler still has an explicit `auth()` call (which
// is enforced by `scripts/security-check.ts`).
async function loadActorAndDoc(
  req: Request,
  clerkUserId: string,
  id: string,
): Promise<LoadActorAndDocResult> {
  const actor = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { candidate: true, enterprise: true },
  });
  if (!actor) {
    return {
      kind: "error",
      response: jsonError(err("UNAUTHORIZED", "User not synced yet"), 401),
    };
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return {
      kind: "error",
      response: jsonError(err("NOT_FOUND", "Document not found"), 404),
    };
  }

  return { kind: "ok", actor, doc, ip: getIp(req) };
}

function actorOwnsDoc(
  actor: { candidate: { id: string } | null; enterprise: { id: string } | null },
  doc: { candidateId: string | null; enterpriseId: string | null },
): boolean {
  if (doc.candidateId && actor.candidate?.id === doc.candidateId) return true;
  if (doc.enterpriseId && actor.enterprise?.id === doc.enterpriseId) return true;
  return false;
}

// ---------- GET ----------

export async function GET(req: Request, { params }: RouteCtx): Promise<NextResponse> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }
  const loaded = await loadActorAndDoc(req, clerkUserId, params.id);
  if (loaded.kind === "error") return loaded.response;
  const { actor, doc, ip } = loaded;

  const allowed = await rateLimit(clerkUserId, "document.read", 60, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests"), 429);
  }

  const role = actor.role;
  const canRead =
    actorOwnsDoc(actor, doc) ||
    role === "STAFF_DOCUMENTS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN";
  if (!canRead) {
    return jsonError(err("FORBIDDEN", "Not allowed to read this document"), 403);
  }

  await logAuditByClerkId(clerkUserId, {
    action: "document.read",
    resourceType: "document",
    resourceId: doc.id,
    ipAddress: ip ?? undefined,
    metadata: { type: doc.type, status: doc.status },
  });

  const dto: DocumentDto = toDocumentDto(doc);
  return NextResponse.json(ok(dto));
}

// ---------- PATCH (STAFF_DOCUMENTS | ADMIN) ----------

export async function PATCH(req: Request, { params }: RouteCtx): Promise<NextResponse> {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return jsonError(err("FORBIDDEN", e.message), 403);
    }
    throw e;
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }
  const loaded = await loadActorAndDoc(req, clerkUserId, params.id);
  if (loaded.kind === "error") return loaded.response;
  const { actor, doc, ip } = loaded;

  const allowed = await rateLimit(clerkUserId, "document.update", 30, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests"), 429);
  }

  if (
    actor.role !== "STAFF_DOCUMENTS" &&
    actor.role !== "ADMIN" &&
    actor.role !== "SUPER_ADMIN"
  ) {
    return jsonError(err("FORBIDDEN", "Staff role required"), 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(err("VALIDATION_ERROR", "Invalid JSON body"), 400);
  }
  const parsed = documentPatchSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "_";
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return jsonError(
      err("VALIDATION_ERROR", "Invalid update payload", { fieldErrors }),
      400,
    );
  }

  // We deliberately do NOT permit overwriting fileUrl through this PATCH —
  // the file lives in storage; uploading a new file is a separate POST.
  const data = parsed.data;
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      ...(data.type ? { type: data.type } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.rejectionNote !== undefined
        ? { rejectionNote: data.rejectionNote ?? null }
        : {}),
      // Stamp verifier when staff approves/rejects.
      ...(data.status === "APPROVED" || data.status === "REJECTED"
        ? { verifiedAt: new Date(), verifiedById: actor.id }
        : {}),
    },
  });

  await logAuditByClerkId(clerkUserId, {
    action: "document.update",
    resourceType: "document",
    resourceId: doc.id,
    ipAddress: ip ?? undefined,
    metadata: {
      previousStatus: doc.status,
      newStatus: updated.status,
      changedFields: Object.keys(data),
    },
  });

  return NextResponse.json(ok(toDocumentDto(updated)));
}

// ---------- DELETE ----------

export async function DELETE(req: Request, { params }: RouteCtx): Promise<NextResponse> {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return jsonError(err("FORBIDDEN", e.message), 403);
    }
    throw e;
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }
  const loaded = await loadActorAndDoc(req, clerkUserId, params.id);
  if (loaded.kind === "error") return loaded.response;
  const { actor, doc, ip } = loaded;

  const allowed = await rateLimit(clerkUserId, "document.delete", 10, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests"), 429);
  }

  const isOwner = actorOwnsDoc(actor, doc);
  const isSuperAdmin = actor.role === "SUPER_ADMIN";
  const isAdmin = actor.role === "ADMIN";

  if (!isOwner && !isSuperAdmin && !isAdmin) {
    return jsonError(err("FORBIDDEN", "Not allowed to delete this document"), 403);
  }

  // Hard delete only for SUPER_ADMIN (e.g. GDPR-driven deletion of binary).
  // Owner + ADMIN: soft-delete by flipping the status to REJECTED with a note.
  // The storage object is left in place; a future cleanup job can sweep
  // REJECTED docs older than N days.
  if (isSuperAdmin) {
    // Hard delete: remove storage object then row.
    const ref = parseStorageRef(doc.fileUrl);
    if (ref) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error: storageErr } = await supabase.storage
          .from(ref.bucket)
          .remove([ref.objectPath]);
        if (storageErr) {
          // Log but proceed — the row deletion is the source-of-truth.
          // eslint-disable-next-line no-console
          console.warn("[document.delete] storage remove failed", storageErr.message);
        }
      }
    }
    await prisma.document.delete({ where: { id: doc.id } });

    await logAuditByClerkId(clerkUserId, {
      action: "document.delete",
      resourceType: "document",
      resourceId: doc.id,
      ipAddress: ip ?? undefined,
      metadata: { kind: "hard", type: doc.type },
    });

    return NextResponse.json(ok({ deleted: true }));
  }

  // Soft delete: mark REJECTED.
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: "REJECTED",
      rejectionNote: doc.rejectionNote ?? "Removed by owner",
    },
  });

  await logAuditByClerkId(clerkUserId, {
    action: "document.delete",
    resourceType: "document",
    resourceId: doc.id,
    ipAddress: ip ?? undefined,
    metadata: {
      kind: "soft",
      type: doc.type,
      previousStatus: doc.status,
    },
  });

  return NextResponse.json(ok({ deleted: true }));
}
