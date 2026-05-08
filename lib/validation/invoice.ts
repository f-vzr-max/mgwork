import { z } from "zod";

export const PAYMENT_METHODS = ["WIRE", "MOBILE_MONEY"] as const;
export const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE"] as const;
export const CURRENCIES = ["MUR", "MGA", "EUR", "USD"] as const;

export const invoiceCreateSchema = z
  .object({
    enterpriseId: z.string().cuid(),
    amount: z.number().positive().max(1_000_000_000),
    currency: z.enum(CURRENCIES).default("MUR"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();

export const invoiceUpdateSchema = z
  .object({
    amount: z.number().positive().max(1_000_000_000).optional(),
    currency: z.enum(CURRENCIES).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    reference: z.string().trim().max(120).optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    paidAt: z.coerce.date().nullable().optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
