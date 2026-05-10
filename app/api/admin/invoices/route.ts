// POST /api/admin/invoices — admin creates a new invoice. Status defaults to
// PENDING. Audit: `invoice.create`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { invoiceCreateSchema } from "@/lib/validation/invoice";
import { ok, err } from "@/types/api";

export async function POST(req: Request) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "invoice.create", 30, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
    );
  }

  const enterprise = await prisma.enterprise.findUnique({
    where: { id: parsed.data.enterpriseId },
    select: { id: true },
  });
  if (!enterprise) {
    return jsonError(404, err("NOT_FOUND", "Enterprise not found"));
  }

  const created = await prisma.invoice.create({
    data: {
      enterpriseId: parsed.data.enterpriseId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference,
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    userId: guard.actor.id,
    action: "invoice.create",
    resourceType: "invoice",
    resourceId: created.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      enterpriseId: created.enterpriseId,
      amount: created.amount,
      currency: created.currency,
    },
  });

  return NextResponse.json(ok({ invoiceId: created.id }));
}
