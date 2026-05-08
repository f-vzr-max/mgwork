import { z } from "zod";

// AI endpoint request schemas — see docs/contracts.md §M5.
// All schemas are strict (reject unknown keys); free-text inputs are constrained
// in length so a malicious user can't make us OOM Claude. Per-route handlers
// additionally run the text through `assertSafeForLLM` before any LLM call.

export const aiMatchSchema = z
  .object({
    offerId: z.string().cuid(),
  })
  .strict();

export const aiExtractCvSchema = z
  .object({
    // The endpoint receives multipart/form-data; this schema covers the JSON
    // metadata fallback (no file expected here, the file is on the form). Kept
    // strict to prevent surprise fields. The actual file handling lives in the
    // route.
  })
  .strict();

const QA_ITEM = z
  .object({
    q: z.string().trim().min(1).max(2000),
    a: z.string().trim().min(1).max(4000),
  })
  .strict();

export const aiLangTestSchema = z
  .object({
    lang: z.enum(["FR", "EN"]),
    answers: z.array(QA_ITEM).min(1).max(20),
  })
  .strict();

export const aiInterviewSimQuestionsSchema = z
  .object({
    phase: z.literal("questions"),
    offerId: z.string().cuid(),
  })
  .strict();

export const aiInterviewSimEvaluateSchema = z
  .object({
    phase: z.literal("evaluate"),
    offerId: z.string().cuid(),
    qa: z.array(QA_ITEM).min(1).max(20),
  })
  .strict();

export const aiInterviewSimSchema = z.discriminatedUnion("phase", [
  aiInterviewSimQuestionsSchema,
  aiInterviewSimEvaluateSchema,
]);

export type AiMatchInput = z.infer<typeof aiMatchSchema>;
export type AiLangTestInput = z.infer<typeof aiLangTestSchema>;
export type AiInterviewSimInput = z.infer<typeof aiInterviewSimSchema>;
export type AiInterviewSimQuestionsInput = z.infer<typeof aiInterviewSimQuestionsSchema>;
export type AiInterviewSimEvaluateInput = z.infer<typeof aiInterviewSimEvaluateSchema>;
