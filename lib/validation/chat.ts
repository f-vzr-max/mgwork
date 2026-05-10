import { z } from "zod";

// Schema for the in-app chat composer payload (POST /api/chat).
// Strict to reject unknown keys.
export const chatMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    // Optional client-supplied locale hint. Server may override based on
    // candidate's stored language preference.
    lang: z.enum(["FR", "EN", "MG"]).optional(),
  })
  .strict();

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
