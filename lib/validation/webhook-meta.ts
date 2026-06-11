import { z } from "zod";

// Meta Cloud API webhook payload schema (subset of fields we use).
// We accept (.passthrough) inside nested objects because Meta's payloads carry
// many vendor-specific fields we don't care about, but the OUTER envelope is
// strict to keep the route handler honest.

const messageSchema = z
  .object({
    from: z.string().min(1).max(64),
    id: z.string().min(1).max(256),
    timestamp: z.string().min(1).max(32),
    type: z.string().min(1).max(32),
    text: z
      .object({ body: z.string().max(10_000) })
      .partial()
      .optional(),
  })
  .passthrough();

const valueSchema = z
  .object({
    messaging_product: z.string().optional(),
    metadata: z
      .object({
        display_phone_number: z.string().optional(),
        phone_number_id: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    contacts: z.array(z.unknown()).optional(),
    messages: z.array(messageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough();

const changeSchema = z
  .object({
    field: z.string().min(1).max(64),
    value: valueSchema,
  })
  .passthrough();

const entrySchema = z
  .object({
    id: z.string().min(1).max(64),
    changes: z.array(changeSchema).optional(),
    messaging: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const metaWebhookEventSchema = z
  .object({
    object: z.string().min(1).max(64),
    entry: z.array(entrySchema).min(1),
  })
  .strict();

export type MetaWebhookEvent = z.infer<typeof metaWebhookEventSchema>;

// One item of entry[].messaging[] — the Messenger Platform / Instagram DM
// event shape (object: "page" | "instagram"). Items are validated one by one
// by the adapter (a malformed sibling must not sink the whole batch), so this
// is exported separately instead of being inlined in `entrySchema.messaging`.
export const messengerMessagingItemSchema = z
  .object({
    sender: z.object({ id: z.string().min(1).max(64) }).passthrough(),
    recipient: z.object({ id: z.string().min(1).max(64) }).passthrough().optional(),
    timestamp: z.number().optional(),
    message: z
      .object({
        mid: z.string().min(1).max(256).optional(),
        text: z.string().max(10_000).optional(),
        is_echo: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    postback: z
      .object({
        payload: z.string().max(1_000).optional(),
        referral: z.object({ ref: z.string().max(256).optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    referral: z.object({ ref: z.string().max(256).optional() }).passthrough().optional(),
  })
  .passthrough();

export type MessengerMessagingItem = z.infer<typeof messengerMessagingItemSchema>;
