// /api/documents
//
//   POST  — CANDIDATE | ENTERPRISE  → multipart upload, returns documentId.
//   GET   — signed-in (caller's own docs only) → list of DocumentDto.
//
// Auth: server resolves the owning Candidate or Enterprise from the session,
// never trusts a client-supplied id. ADMINs are not expected to upload
// through this route (they review via M4 staff queue) but they CAN list
// their own owned docs (which will normally be empty).
// Audit: `document.upload` on POST. GET is a low-volume, low-sensitivity
// listing of metadata-only DTOs and is intentionally not audited (each
// signed-url issuance still is, via the dedicated endpoint).

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  bucketForDocumentType,
  buildDocumentObjectPath,
  encodeStorageRef,
  toDocumentDto,
  type DocumentDto,
} from "@/lib/documents";
import { DOCUMENT_TYPES } from "@/lib/validation/document";
import { err, ok, type ApiResponse } from "@/types/api";

// Multipart-meta schema — only the non-file fields. We accept either
// `expiresAt` as a string or omit it. The actual `file` is read via FormData.
const uploadMetaSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    expiresAt: z.coerce.date().optional(),
  })
  .strict();

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function jsonError(
  body: ApiResponse<unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, { status });
}

// ---------- GET (caller's own documents) ----------

export async function GET(): Promise<NextResponse> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return jsonError(err("UNAUTHORIZED", "Sign in required"), 401);
  }
  const allowed = await rateLimit(clerkUserId, "documents.list", 60, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many requests"), 429);
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { candidate: true, enterprise: true },
  });
  if (!user) {
    return jsonError(err("UNAUTHORIZED", "User not synced yet"), 401);
  }

  const ownedFilter = [];
  if (user.candidate) ownedFilter.push({ candidateId: user.candidate.id });
  if (user.enterprise) ownedFilter.push({ enterpriseId: user.enterprise.id });
  if (ownedFilter.length === 0) {
    return NextResponse.json(ok({ items: [] satisfies DocumentDto[] }));
  }

  const rows = await prisma.document.findMany({
    where: { OR: ownedFilter },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const items = rows.map(toDocumentDto);
  return NextResponse.json(ok({ items }));
}

// ---------- POST (multipart upload) ----------

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF defense-in-depth before reading the body.
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

  // Rate limit: 10 uploads per minute per user.
  const allowed = await rateLimit(clerkUserId, "document.upload", 10, 60);
  if (!allowed) {
    return jsonError(err("RATE_LIMITED", "Too many uploads, slow down"), 429);
  }

  // Resolve the internal User row + their Candidate/Enterprise profile.
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { candidate: true, enterprise: true },
  });
  if (!user) {
    return jsonError(err("UNAUTHORIZED", "User not synced yet"), 401);
  }
  if (user.role !== "CANDIDATE" && user.role !== "ENTERPRISE") {
    return jsonError(err("FORBIDDEN", "Role cannot upload documents"), 403);
  }

  const ownerKind: "candidate" | "enterprise" =
    user.role === "CANDIDATE" ? "candidate" : "enterprise";
  const ownerProfileId =
    ownerKind === "candidate" ? user.candidate?.id : user.enterprise?.id;
  if (!ownerProfileId) {
    return jsonError(
      err("FORBIDDEN", `${ownerKind} profile not yet created`),
      403,
    );
  }

  // Parse multipart form-data.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(
      err("UNSUPPORTED_MEDIA_TYPE", "Expected multipart/form-data"),
      415,
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(
      err("VALIDATION_ERROR", "Could not parse multipart payload"),
      400,
    );
  }

  // Validate non-file meta.
  const meta = uploadMetaSchema.safeParse({
    type: form.get("type") ?? undefined,
    expiresAt: form.get("expiresAt") || undefined,
  });
  if (!meta.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of meta.error.issues) {
      const k = issue.path.join(".") || "_";
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return jsonError(
      err("VALIDATION_ERROR", "Invalid upload metadata", { fieldErrors }),
      400,
    );
  }

  // Validate file presence + MIME + size.
  const file = form.get("file");
  if (!(file instanceof Blob) || typeof (file as File).name !== "string") {
    return jsonError(err("VALIDATION_ERROR", "Missing 'file' field"), 400);
  }
  const f = file as File;
  if (f.size <= 0) {
    return jsonError(err("VALIDATION_ERROR", "Empty file"), 400);
  }
  if (f.size > MAX_UPLOAD_BYTES) {
    return jsonError(err("PAYLOAD_TOO_LARGE", "File exceeds 10 MB"), 413);
  }
  const mime = (f.type ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return jsonError(
      err(
        "UNSUPPORTED_MEDIA_TYPE",
        `Unsupported file type: ${mime || "unknown"}`,
      ),
      415,
    );
  }

  // Push to Supabase storage.
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonError(
      err("EXTERNAL_DEPENDENCY_FAILED", "Storage not configured"),
      500,
    );
  }
  const bucket = bucketForDocumentType(meta.data.type);
  const objectPath = buildDocumentObjectPath({
    role: ownerKind,
    userId: user.id,
    type: meta.data.type,
    filename: f.name,
  });
  const buffer = Buffer.from(await f.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });
  if (uploadErr) {
    return jsonError(
      err("EXTERNAL_DEPENDENCY_FAILED", `Upload failed: ${uploadErr.message}`),
      502,
    );
  }

  // Persist Document row.
  const fileUrl = encodeStorageRef(bucket, objectPath);
  const document = await prisma.document.create({
    data: {
      type: meta.data.type,
      fileUrl,
      expiresAt: meta.data.expiresAt ?? null,
      candidateId: ownerKind === "candidate" ? ownerProfileId : null,
      enterpriseId: ownerKind === "enterprise" ? ownerProfileId : null,
    },
  });

  // Audit. Never log the full object path (PII linkage); type + bucket only.
  await logAuditByClerkId(clerkUserId, {
    action: "document.upload",
    resourceType: "document",
    resourceId: document.id,
    ipAddress: getIp(req) ?? undefined,
    metadata: {
      type: meta.data.type,
      bucket,
      sizeBytes: f.size,
      mime,
      ownerKind,
    },
  });

  return NextResponse.json(ok({ documentId: document.id }), { status: 201 });
}
