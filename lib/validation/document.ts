import { z } from "zod";

export const DOCUMENT_TYPES = [
  "PASSPORT",
  "MEDICAL_AUTHORIZATION",
  "WORK_PERMIT",
  "VISA",
  "INCORPORATION_CERTIFICATE",
  "OTHER",
] as const;

export const DOCUMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;

export const documentCreateSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    fileUrl: z.string().url(),
    expiresAt: z.coerce.date().optional(),
    candidateId: z.string().cuid().optional(),
    enterpriseId: z.string().cuid().optional(),
  })
  .strict()
  .refine((d) => Boolean(d.candidateId) !== Boolean(d.enterpriseId), {
    message: "exactly one of candidateId or enterpriseId is required",
    path: ["candidateId"],
  });

export const documentUpdateSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES).optional(),
    fileUrl: z.string().url().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    status: z.enum(DOCUMENT_STATUSES).optional(),
    rejectionNote: z.string().trim().max(2000).optional(),
  })
  .strict();

// Aliases / additions used by docs/contracts.md (M3, M4 routes).
export const documentUploadSchema = documentCreateSchema;
export const documentPatchSchema = documentUpdateSchema;

export const documentApproveSchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const documentRejectSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentApproveInput = z.infer<typeof documentApproveSchema>;
export type DocumentRejectInput = z.infer<typeof documentRejectSchema>;
