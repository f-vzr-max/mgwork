// PATCH /api/admin/invoices/[id] — partial update. Status, paidAt, notes,
// reference, etc. Audit: `invoice.update`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { invoiceUpdateSchema } from "@/lib/validation/invoice";
import { ok, err } from "@/types/api";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "invoice.update", 60, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = invoiceUpdateSchema.safeParse(body);
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

  const data = parsed.data;
  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.paymentMethod !== undefined
        ? { paymentMethod: data.paymentMethod }
        : {}),
      ...(data.reference !== undefined ? { reference: data.reference } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  await logAudit({
    userId: guard.actor.id,
    action: "invoice.update",
    resourceType: "invoice",
    resourceId: updated.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      changedFields: Object.keys(parsed.data),
    },
  });

  return NextResponse.json(ok({ invoiceId: updated.id, status: updated.status }));
}
