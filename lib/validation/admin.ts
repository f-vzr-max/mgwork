import { z } from "zod";
import { ROLES } from "@/lib/roles";

// Each weight is bounded 0..100. We do NOT enforce sum == 100 here because
// `computeCompatibilityScore` already normalizes against the weight sum, so any
// non-negative shape works. We do reject all-zero (would zero out matching).

const WEIGHT = z.number().int().min(0).max(100);

export const matchingWeightsSchema = z
  .object({
    skills: WEIGHT,
    languages: WEIGHT,
    sector: WEIGHT,
    mobility: WEIGHT,
    experience: WEIGHT,
    documents: WEIGHT,
  })
  .strict()
  .refine(
    (w) =>
      w.skills + w.languages + w.sector + w.mobility + w.experience + w.documents > 0,
    { message: "at least one weight must be > 0" },
  );

export const matchingConfigUpdateSchema = z
  .object({
    weights: matchingWeightsSchema,
  })
  .strict();

export type MatchingWeightsInput = z.infer<typeof matchingWeightsSchema>;
export type MatchingConfigUpdateInput = z.infer<typeof matchingConfigUpdateSchema>;

// ---------------------------------------------------------------------------
// M8 Admin schemas
// ---------------------------------------------------------------------------

export const adminUserListQuerySchema = z
  .object({
    role: z.enum(ROLES).optional(),
    verified: z.enum(["true", "false"]).optional(),
    lang: z.enum(["FR", "EN", "MG"]).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const userBanSchema = z
  .object({
    banned: z.boolean(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type UserBanInput = z.infer<typeof userBanSchema>;

export const userRoleSchema = z
  .object({
    role: z.enum(ROLES),
  })
  .strict();
export type UserRoleInput = z.infer<typeof userRoleSchema>;

export const auditQuerySchema = z
  .object({
    userId: z.string().cuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    resourceType: z.string().trim().min(1).max(80).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const featureFlagUpsertSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9_.-]+$/, "lowercase, digits, dot, dash, underscore"),
    enabled: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type FeatureFlagUpsertInput = z.infer<typeof featureFlagUpsertSchema>;

export const translationUpsertSchema = z
  .object({
    lang: z.enum(["FR", "EN", "MG"]),
    key: z.string().trim().min(1).max(200),
    value: z.string().min(0).max(4000),
  })
  .strict();
export type TranslationUpsertInput = z.infer<typeof translationUpsertSchema>;

export const translationListQuerySchema = z
  .object({
    lang: z.enum(["FR", "EN", "MG"]).optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();
export type TranslationListQuery = z.infer<typeof translationListQuerySchema>;

export const invoiceMarkPaidSchema = z
  .object({
    paymentMethod: z.enum(["WIRE", "MOBILE_MONEY"]),
    reference: z.string().trim().min(1).max(120),
  })
  .strict();
export type InvoiceMarkPaidInput = z.infer<typeof invoiceMarkPaidSchema>;

export const invoiceListQuerySchema = z
  .object({
    status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
    enterpriseId: z.string().cuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const languageUpdateSchema = z
  .object({
    lang: z.enum(["FR", "EN", "MG"]),
  })
  .strict();
export type LanguageUpdateInput = z.infer<typeof languageUpdateSchema>;
