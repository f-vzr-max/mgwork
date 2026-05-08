import { z } from "zod";

export const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_DONE",
  "OFFER_MADE",
  "DEPLOYED",
  "COMPLETED",
  "REJECTED",
] as const;

export const applicationCreateSchema = z
  .object({
    candidateId: z.string().cuid(),
    jobOfferId: z.string().cuid(),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();

export const applicationUpdateSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    notes: z.string().trim().max(4000).optional(),
    aiScore: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateSchema>;
