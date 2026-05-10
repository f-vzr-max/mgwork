// POST /api/admin/invoices/[id]/mark-paid
//
// Sets status=PAID + paidAt=now + records the payment method and reference.
// Idempotent against subsequent calls (returns same status). Audit:
// `invoice.mark_paid`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { invoiceMarkPaidSchema } from "@/lib/validation/admin";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "invoice.mark_paid", 60, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = invoiceMarkPaidSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
    );
  }

  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError(404, err("NOT_FOUND", "Invoice not found"));

  if (existing.status === "PAID") {
    return NextResponse.json(
      ok({ invoiceId: existing.id, status: "PAID" as const }),
    );
  }

  const now = new Date();
  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: "PAID",
      paidAt: now,
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference,
    },
  });

  await logAudit({
    userId: guard.actor.id,
    action: "invoice.mark_paid",
    resourceType: "invoice",
    resourceId: updated.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference,
      amount: updated.amount,
      currency: updated.currency,
    },
  });

  return NextResponse.json(ok({ invoiceId: updated.id, status: "PAID" as const }));
}
