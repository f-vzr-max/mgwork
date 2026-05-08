import { z } from "zod";

// `.strict()` rejects unknown keys, in line with the security audit checklist.

const SKILL = z.string().trim().min(1).max(80);
const SECTOR = z.string().trim().min(1).max(80);

export const candidateCreateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    dateOfBirth: z.coerce.date().optional(),
    nationality: z.string().trim().length(2).default("MG"),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 .\-()]{6,30}$/)
      .optional(),
    city: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(2000).optional(),
    skills: z.array(SKILL).max(50).default([]),
    sectors: z.array(SECTOR).max(20).default([]),
    langScoreFR: z.number().int().min(0).max(100).optional(),
    langScoreEN: z.number().int().min(0).max(100).optional(),
    cvFileUrl: z.string().url().optional(),
  })
  .strict();

export const candidateUpdateSchema = candidateCreateSchema.partial();

export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;
