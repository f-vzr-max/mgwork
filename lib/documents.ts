// Document module helpers — bucket mapping, file validation, MIME enforcement,
// and DocumentDto projection. Used by the M3 routes and the staff queue (M4).

import type { Document, DocumentStatus, DocumentType } from "@prisma/client";

// Buckets created externally (see supabase/policies.sql lines 605–645):
//   passports, medical-docs, cvs, scans, visas
// Map every DocumentType to one. We deliberately put non-passport / non-medical /
// non-visa documents under `scans` so the storage policy still applies.
export function bucketForDocumentType(type: DocumentType): string {
  switch (type) {
    case "PASSPORT":
      return "passports";
    case "MEDICAL_AUTHORIZATION":
      return "medical-docs";
    case "VISA":
      return "visas";
    case "WORK_PERMIT":
    case "INCORPORATION_CERTIFICATE":
    case "OTHER":
    default:
      return "scans";
  }
}

// 10 MB per the spec.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Allowed MIME types per the spec.
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Some browsers send legacy DOC type for DOCX; reject DOC silently is fine.
]);

export function isAllowedMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

// Sanitize a filename: keep alphanumerics, dots, dashes, underscores only.
// Truncate to a reasonable length so the storage path doesn't blow up.
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[^A-Za-z0-9_.\-]+/g, "_");
  return safe.length > 120 ? safe.slice(0, 120) : safe || "file";
}

// Build a storage object path: `{role}/{userId}/{type}/{uuid}-{filename}`.
// userId is the **internal User.id (cuid)** — never the Clerk id — so RLS
// policies (storage.foldername(name))[2] = current_user_id() match.
export function buildDocumentObjectPath(input: {
  role: "candidate" | "enterprise";
  userId: string;
  type: DocumentType;
  filename: string;
}): string {
  const safeName = sanitizeFilename(input.filename);
  const uuid = globalThis.crypto.randomUUID();
  return `${input.role}/${input.userId}/${input.type}/${uuid}-${safeName}`;
}

// Dispute attachments (admin-only evidence on a Checkpoint) live in their own
// bucket so storage policies can stay per-bucket. Created externally — see
// supabase/buckets_2026-06-11_disputes_avatars.sql.
export const DISPUTE_ATTACHMENTS_BUCKET = "dispute-attachments";

export function bucketForDisputeAttachment(): string {
  return DISPUTE_ATTACHMENTS_BUCKET;
}

// Build a dispute-attachment object path: `admin/{userId}/{checkpointId}/{uuid}-{filename}`.
// Keeps the `{role}/{userId}/...` prefix convention so the per-bucket owner
// storage policy ((storage.foldername(name))[2]) still lines up. userId is the
// internal User.id of the uploading admin.
export function buildDisputeAttachmentObjectPath(input: {
  userId: string;
  checkpointId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(input.filename);
  const uuid = globalThis.crypto.randomUUID();
  return `admin/${input.userId}/${input.checkpointId}/${uuid}-${safeName}`;
}

// Public DTO. Never includes the raw fileUrl (only metadata; clients fetch via
// the dedicated signed-url endpoint).
export type DocumentDto = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  expiresAt: string | null;
  rejectionNote: string | null;
  verifiedAt: string | null;
  candidateId: string | null;
  enterpriseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toDocumentDto(d: Document): DocumentDto {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    rejectionNote: d.rejectionNote,
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    candidateId: d.candidateId,
    enterpriseId: d.enterpriseId,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

// Storage reference encoded into the Document.fileUrl column. We stash both
// the bucket and the object path so future readers can issue signed URLs
// without re-deriving the bucket. Format: `supabase://{bucket}/{path}`.
export function encodeStorageRef(bucket: string, objectPath: string): string {
  return `supabase://${bucket}/${objectPath}`;
}

export function parseStorageRef(
  ref: string,
): { bucket: string; objectPath: string } | null {
  const m = /^supabase:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!m || !m[1] || !m[2]) return null;
  return { bucket: m[1], objectPath: m[2] };
}
