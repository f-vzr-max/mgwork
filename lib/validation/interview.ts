import { z } from "zod";

// Interview-related zod schemas (M7).
// `.strict()` rejects unknown keys, in line with the security audit checklist.

export const INTERVIEW_TYPES = ["VIDEO", "PHONE", "IN_PERSON"] as const;
export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
] as const;

export const interviewCreateSchema = z
  .object({
    applicationId: z.string().cuid(),
    scheduledAt: z.coerce.date(),
    type: z.enum(INTERVIEW_TYPES),
    videoUrl: z.string().url().optional(),
  })
  .strict();

export const interviewUpdateSchema = z
  .object({
    status: z.enum(INTERVIEW_STATUSES).optional(),
    videoUrl: z.string().url().optional().nullable(),
    enterpriseNotes: z.string().trim().max(4000).optional().nullable(),
    candidateNotes: z.string().trim().max(4000).optional().nullable(),
    scheduledAt: z.coerce.date().optional(),
  })
  .strict();

// Departure checklist JSON shape.
// All sections optional so partial-fill UX works; nested objects strict.
const packingItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().trim().min(1).max(200),
    done: z.boolean(),
  })
  .strict();

export const departureChecklistSchema = z
  .object({
    flight: z
      .object({
        booked: z.boolean(),
        date: z.string().trim().max(40).optional(),
        ref: z.string().trim().max(80).optional(),
      })
      .strict()
      .optional(),
    housing: z
      .object({
        confirmed: z.boolean(),
        address: z.string().trim().max(400).optional(),
      })
      .strict()
      .optional(),
    emergency: z
      .object({
        contactName: z.string().trim().max(200).optional(),
        phone: z.string().trim().max(40).optional(),
      })
      .strict()
      .optional(),
    packing: z
      .object({
        items: z.array(packingItemSchema).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();

export const departureChecklistUpdateSchema = z
  .object({
    checklist: departureChecklistSchema,
  })
  .strict();

export const checkinRespondSchema = z
  .object({
    checkinPingId: z.string().cuid(),
    response: z.string().trim().min(1).max(4000),
  })
  .strict();

export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>;
export type InterviewUpdateInput = z.infer<typeof interviewUpdateSchema>;
export type DepartureChecklist = z.infer<typeof departureChecklistSchema>;
export type DepartureChecklistUpdateInput = z.infer<
  typeof departureChecklistUpdateSchema
>;
export type CheckinRespondInput = z.infer<typeof checkinRespondSchema>;
