import { z } from "zod";

export const OFFER_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] as const;

const REQUIREMENT = z.string().trim().min(1).max(120);
const LANG_CODE = z.enum(["FR", "EN", "MG"]);

export const jobOfferCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(8000),
    sector: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(120).default("Mauritius"),
    slots: z.number().int().min(1).max(1000).default(1),
    status: z.enum(OFFER_STATUSES).default("DRAFT"),
    requirements: z.array(REQUIREMENT).max(50).default([]),
    langRequired: z.array(LANG_CODE).max(5).default([]),
  })
  .strict();

export const jobOfferUpdateSchema = jobOfferCreateSchema.partial();

// Aliases used by docs/contracts.md.
export const offerCreateSchema = jobOfferCreateSchema;
export const offerUpdateSchema = jobOfferUpdateSchema;

export type JobOfferCreateInput = z.infer<typeof jobOfferCreateSchema>;
export type JobOfferUpdateInput = z.infer<typeof jobOfferUpdateSchema>;
