import { z } from "zod";

// `.strict()` rejects unknown keys, in line with the security audit checklist.

const SKILL = z.string().trim().min(1).max(80);
const SECTOR = z.string().trim().min(1).max(80);

// Reject DOBs less than 18 years before today.
const isAtLeast18 = (d: Date) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d.getTime() <= cutoff.getTime();
};

// Phone normaliser. Accepts Madagascar (+261, 9 subscriber digits) and
// Mauritius (+230, 8 subscriber digits). Accepts:
//   - +261 / +230 prefix (with or without separators)
//   - 0XXXXXXXXX (Madagascar national format with leading zero)
//   - bare digits (assumed Madagascar)
// Emits +261 followed by 9 digits, or +230 followed by 8 digits.
const PHONE_INPUT_RE = /^(\+261|\+230|0)?[\s.\-()]*[0-9](?:[\s.\-()]*[0-9]){5,12}$/;

// Final canonical shape: +261 followed by 9 digits (Madagascar) or +230
// followed by 8 digits (Mauritius), once the country code or trunk-0 is
// stripped.
const NORMALISED_PHONE_RE = /^(?:\+261\d{9}|\+230\d{8})$/;

export function normaliseMgPhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+230")) return digits;
  // Bare "230..." is Mauritius only at the exact +230 length (8 subscriber
  // digits); otherwise fall through so a bare MG number starting 230 stays MG.
  if (digits.startsWith("230") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("+261")) return digits;
  if (digits.startsWith("0")) return "+261" + digits.slice(1);
  if (digits.startsWith("261")) return "+" + digits;
  return "+261" + digits;
}

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_INPUT_RE)
  .transform((v) => normaliseMgPhone(v))
  .refine((v) => NORMALISED_PHONE_RE.test(v), {
    message: "Numéro invalide (Madagascar +261 ou Maurice +230)",
  });

export const candidateCreateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    dateOfBirth: z.coerce
      .date()
      .refine(isAtLeast18, { message: "Vous devez avoir au moins 18 ans" })
      .optional(),
    nationality: z.string().trim().length(2).default("MG"),
    phone: phoneSchema.optional(),
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
