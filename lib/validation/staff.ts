import { z } from "zod";

// CheckpointStatus mirrors prisma enum.
export const CHECKPOINT_STATUSES = ["OK", "ALERT", "INTERVENTION_REQUIRED"] as const;

export const checkpointCreateSchema = z
  .object({
    applicationId: z.string().cuid(),
    status: z.enum(CHECKPOINT_STATUSES),
    notes: z.string().trim().max(4000).optional(),
    interventionLog: z.string().trim().max(4000).optional(),
  })
  .strict();

// Resource types we allow staff to attach private notes to. Keep this list
// tight: every value must map to a real Prisma model. Loose strings would
// invite typo-driven orphans.
export const STAFF_NOTE_RESOURCE_TYPES = [
  "candidate",
  "enterprise",
  "application",
  "document",
  "checkpoint",
] as const;

export const staffNoteCreateSchema = z
  .object({
    resourceType: z.enum(STAFF_NOTE_RESOURCE_TYPES),
    resourceId: z.string().cuid(),
    note: z.string().trim().min(1).max(4000),
  })
  .strict();

export type CheckpointCreateInput = z.infer<typeof checkpointCreateSchema>;
export type StaffNoteCreateInput = z.infer<typeof staffNoteCreateSchema>;
