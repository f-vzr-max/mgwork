// /api/admin/disputes/[id]/attachments — [id] is a Checkpoint id (a "dispute"
// is a Checkpoint in INTERVENTION_REQUIRED).
//
//   POST — ADMIN | SUPER_ADMIN → multipart upload, returns the attachment DTO.
//   GET  — ADMIN | SUPER_ADMIN → list attachments with 15-min signed URLs
//          (mirrors app/api/documents/[id]/signed-url).
//
// Storage: private `dispute-attachments` bucket (created externally — see
// supabase/buckets_2026-06-11_disputes_avatars.sql; uploads 500 until it
// exists). Validation reuses the document helpers: same MIME allowlist,
// 10 MB cap, sanitized filename and `supabase://` storage-ref encoding.
// Audit: `dispute_attachment.upload` / `dispute_attachment.signed_url_issued`.

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, createSignedUrl } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  bucketForDisputeAttachment,
  buildDisputeAttachmentObjectPath,
  encodeStorageRef,
  parseStorageRef,
} from "@/lib/documents";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes, same as documents

export type DisputeAttachmentDto = {
  id: string;
  checkpointId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  // Signed URL (15 min). Null when the storage ref is malformed or signing
  // failed — the row still lists so the metadata stays visible.
  url: string | null;
  urlExpiresAt: string | null;
};

// ---------- GET (list attachments + signed URLs) ----------

export async function GET(req: Request, { params }: Params) {
  // GET is not state-changing — skip CSRF like the other admin list routes.
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"], { skipCsrf: true });
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "dispute_attachment.list", 60, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!checkpoint) return jsonError(404, err("NOT_FOUND", "Dispute not found"));

  const rows = await prisma.disputeAttachment.findMany({
    where: { checkpointId: checkpoint.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const items: DisputeAttachmentDto[] = await Promise.all(
    rows.map(async (row) => {
      const ref = parseStorageRef(row.fileUrl);
      const signed = ref
        ? await createSignedUrl(ref.bucket, ref.objectPath, SIGNED_URL_TTL_SECONDS)
        : null;
      const okSigned = signed && !("error" in signed) ? signed : null;
      return {
        id: row.id,
        checkpointId: row.checkpointId,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt.toISOString(),
        url: okSigned?.url ?? null,
        urlExpiresAt: okSigned?.expiresAt.toISOString() ?? null,
      };
    }),
  );

  // One audit entry per listing (not per URL) — signed-URL issuance has side
  // effects worth tracing, but per-row logging would just be noise here.
  if (items.some((i) => i.url !== null)) {
    await logAudit({
      userId: guard.actor.id,
      action: "dispute_attachment.signed_url_issued",
      resourceType: "checkpoint",
      resourceId: checkpoint.id,
      ipAddress: guard.ip ?? undefined,
      metadata: { count: items.length, ttlSeconds: SIGNED_URL_TTL_SECONDS },
    });
  }

  return NextResponse.json(ok({ items }), {
    headers: { "Cache-Control": "no-store" },
  });
}

// ---------- POST (multipart upload) ----------

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  // 10 uploads per minute per admin, same budget as document uploads.
  if (!(await rateLimit(guard.actor.id, "dispute_attachment.upload", 10, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many uploads, slow down"));
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!checkpoint) return jsonError(404, err("NOT_FOUND", "Dispute not found"));

  // Parse multipart form-data.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(415, err("UNSUPPORTED_MEDIA_TYPE", "Expected multipart/form-data"));
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, err("VALIDATION_ERROR", "Could not parse multipart payload"));
  }

  // Validate file presence + MIME + size (same gates as /api/documents).
  const file = form.get("file");
  if (!(file instanceof Blob) || typeof (file as File).name !== "string") {
    return jsonError(400, err("VALIDATION_ERROR", "Missing 'file' field"));
  }
  const f = file as File;
  if (f.size <= 0) {
    return jsonError(400, err("VALIDATION_ERROR", "Empty file"));
  }
  if (f.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, err("PAYLOAD_TOO_LARGE", "File exceeds 10 MB"));
  }
  const mime = (f.type ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return jsonError(
      415,
      err("UNSUPPORTED_MEDIA_TYPE", `Unsupported file type: ${mime || "unknown"}`),
    );
  }

  // Push to Supabase storage.
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonError(500, err("EXTERNAL_DEPENDENCY_FAILED", "Storage not configured"));
  }
  const bucket = bucketForDisputeAttachment();
  const objectPath = buildDisputeAttachmentObjectPath({
    userId: guard.actor.id,
    checkpointId: checkpoint.id,
    filename: f.name,
  });
  const buffer = Buffer.from(await f.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: mime, upsert: false });
  if (uploadErr) {
    return jsonError(
      502,
      err("EXTERNAL_DEPENDENCY_FAILED", `Upload failed: ${uploadErr.message}`),
    );
  }

  // Persist the DisputeAttachment row.
  const attachment = await prisma.disputeAttachment.create({
    data: {
      checkpointId: checkpoint.id,
      fileUrl: encodeStorageRef(bucket, objectPath),
      filename: f.name.slice(0, 255),
      mimeType: mime,
      sizeBytes: f.size,
      uploadedById: guard.actor.id,
    },
  });

  // Audit. Never log the full object path (PII linkage); bucket + size only.
  await logAudit({
    userId: guard.actor.id,
    action: "dispute_attachment.upload",
    resourceType: "checkpoint",
    resourceId: checkpoint.id,
    ipAddress: guard.ip ?? undefined,
    metadata: { attachmentId: attachment.id, bucket, sizeBytes: f.size, mime },
  });

  return NextResponse.json(
    ok({
      attachmentId: attachment.id,
      checkpointId: attachment.checkpointId,
      filename: attachment.filename,
      createdAt: attachment.createdAt.toISOString(),
    }),
    { status: 201 },
  );
}
