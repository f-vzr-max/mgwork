// GET /api/admin/translations  — ADMIN/SUPER_ADMIN list (filterable by lang)
// PUT /api/admin/translations  — ADMIN/SUPER_ADMIN upsert per (lang, key).
// Audit: `translation.update`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import {
  translationListQuerySchema,
  translationUpsertSchema,
} from "@/lib/validation/admin";
import { ok, err } from "@/types/api";

export async function GET(req: Request) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"], { skipCsrf: true });
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "translation.list", 120, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const url = new URL(req.url);
  const cleaned: Record<string, string> = {};
  for (const k of ["lang", "q"]) {
    const v = url.searchParams.get(k);
    if (v) cleaned[k] = v;
  }
  const parsed = translationListQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    return jsonError(400, err("VALIDATION_ERROR", "Invalid query"));
  }

  const where = {
    ...(parsed.data.lang ? { lang: parsed.data.lang } : {}),
    ...(parsed.data.q ? { key: { contains: parsed.data.q } } : {}),
  };

  const rows = await prisma.translation.findMany({
    where,
    orderBy: [{ lang: "asc" }, { key: "asc" }],
    take: 1000,
  });

  return NextResponse.json(
    ok(
      rows.map((r) => ({
        id: r.id,
        lang: r.lang,
        key: r.key,
        value: r.value,
      })),
    ),
  );
}

export async function PUT(req: Request) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "translation.update", 120, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = translationUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
    );
  }

  const previous = await prisma.translation.findUnique({
    where: { lang_key: { lang: parsed.data.lang, key: parsed.data.key } },
  });

  const upserted = await prisma.translation.upsert({
    where: { lang_key: { lang: parsed.data.lang, key: parsed.data.key } },
    create: {
      lang: parsed.data.lang,
      key: parsed.data.key,
      value: parsed.data.value,
    },
    update: { value: parsed.data.value },
  });

  await logAudit({
    userId: guard.actor.id,
    action: "translation.update",
    resourceType: "translation",
    resourceId: upserted.id,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      lang: parsed.data.lang,
      key: parsed.data.key,
      hadPrevious: !!previous,
    },
  });

  return NextResponse.json(
    ok({
      id: upserted.id,
      lang: upserted.lang,
      key: upserted.key,
      value: upserted.value,
    }),
  );
}
