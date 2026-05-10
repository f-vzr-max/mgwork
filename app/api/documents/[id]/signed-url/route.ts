// GET /api/documents/[id]/signed-url
//
// Issues a 15-minute signed URL for the underlying storage object. Split out
// from the regular GET so the URL never accidentally leaks via list responses
// or third-party renderers.
//
// Auth: owner | STAFF_DOCUMENTS | ADMIN | SUPER_ADMIN.
// Audit: `document.signed_url_issued`.
//
// NOTE: GET routes don't normally require CSRF/origin checks (they're not
// state-changing), but signed URL issuance has side effects worth auditing,
// so we still rate-limit and audit. We keep CSRF off so legitimate
// `<a href="/api/documents/x/signed-url">` flows still work.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { createSignedUrl } from "@/lib/supabase";
import { parseStorageRef } from "@/lib/documents";
import { err, ok, type ApiResponse, type SignedUrlResponse } from "@/types/api";

type RouteCtx = { params: { id: string } };

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes per spec

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function jsonError(body: ApiResponse<unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(req: Request, { params }: RouteCtx): Promise<NextResponse> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }

  // Rate limit: 30 / minute per user. Mid-range so doc viewers can flip
  // between several files, but scrapers get cut off quickly.
  const allowed = await rateLimit(clerkUserId, "document.signed_url", 30, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many signed-URL requests"), 429);
  }

  const actor = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { candidate: true, enterprise: true },
  });
  if (!actor) {
    return jsonError(err("UNAUTHORIZED", "User not synced yet"), 401);
  }

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) {
    return jsonError(err("NOT_FOUND", "Document not found"), 404);
  }

  const isOwner =
    (doc.candidateId && actor.candidate?.id === doc.candidateId) ||
    (doc.enterpriseId && actor.enterprise?.id === doc.enterpriseId);
  const canRead =
    isOwner ||
    actor.role === "STAFF_DOCUMENTS" ||
    actor.role === "ADMIN" ||
    actor.role === "SUPER_ADMIN";
  if (!canRead) {
    return jsonError(err("FORBIDDEN", "Not allowed to read this document"), 403);
  }

  const ref = parseStorageRef(doc.fileUrl);
  if (!ref) {
    return jsonError(
      err(
        "EXTERNAL_DEPENDENCY_FAILED",
        "Document storage reference is malformed",
      ),
      500,
    );
  }

  const signed = await createSignedUrl(ref.bucket, ref.objectPath, SIGNED_URL_TTL_SECONDS);
  if ("error" in signed) {
    if (signed.error === "no-config") {
      return jsonError(
        err("EXTERNAL_DEPENDENCY_FAILED", "Storage not configured"),
        500,
      );
    }
    return jsonError(
      err("EXTERNAL_DEPENDENCY_FAILED", `Storage error: ${signed.message}`),
      502,
    );
  }

  // Audit AFTER success — failures shouldn't claim a URL was issued.
  await logAuditByClerkId(clerkUserId, {
    action: "document.signed_url_issued",
    resourceType: "document",
    resourceId: doc.id,
    ipAddress: getIp(req) ?? undefined,
    metadata: {
      bucket: ref.bucket,
      ttlSeconds: SIGNED_URL_TTL_SECONDS,
      role: actor.role,
    },
  });

  const payload: SignedUrlResponse = {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
  return NextResponse.json(ok(payload), {
    headers: { "Cache-Control": "no-store" },
  });
}
