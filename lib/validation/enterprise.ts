import { z } from "zod";
import { phoneSchema } from "./candidate";

const PLAN = z.enum(["FREE", "STARTER", "PRO"]);

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
