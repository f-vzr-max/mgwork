import { z } from "zod";
import { normaliseMgPhone } from "./candidate";

const PLAN = z.enum(["FREE", "STARTER", "PRO"]);

const PHONE_INPUT_RE = /^(\+261|0)?[\s.\-()]*[0-9](?:[\s.\-()]*[0-9]){5,12}$/;
const NORMALISED_PHONE_RE = /^\+261\d{9}$/;

const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_INPUT_RE)
  .transform((v) => normaliseMgPhone(v))
  .refine((v) => NORMALISED_PHONE_RE.test(v), {
    message: "Numéro Madagascar invalide (9 chiffres attendus)",
  });

export const enterpriseCreateSchema = z
  .object({
    companyName: z.string().trim().min(1).max(240),
    registrationNumber: z.string().trim().max(80).optional(),
    sector: z.string().trim().max(80).optional(),
    address: z.string().trim().max(400).optional(),
    contactName: z.string().trim().max(120).optional(),
    contactPhone: phoneSchema.optional(),
    plan: PLAN.default("FREE"),
  })
  .strict();

export const enterpriseUpdateSchema = enterpriseCreateSchema.partial();

export type EnterpriseCreateInput = z.infer<typeof enterpriseCreateSchema>;
export type EnterpriseUpdateInput = z.infer<typeof enterpriseUpdateSchema>;
