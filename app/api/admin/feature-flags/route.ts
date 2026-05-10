// GET /api/admin/feature-flags — ADMIN/SUPER_ADMIN list.
// PUT /api/admin/feature-flags — SUPER_ADMIN upsert by key. Audit:
// `feature_flag.toggle`. The contract describes a `[key]` sub-route as well,
// but we expose a single PUT here that takes `{ key, enabled, metadata? }`
// since the resource is a singleton-per-key.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { requireAdmin, jsonError } from "@/lib/admin-guard";
import { featureFlagUpsertSchema } from "@/lib/validation/admin";
import { ok, err } from "@/types/api";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const guard = await requireAdmin(req, ["ADMIN", "SUPER_ADMIN"], { skipCsrf: true });
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "feature_flag.list", 120, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json(
    ok(
      flags.map((f) => ({
        key: f.key,
        enabled: f.enabled,
        metadata: f.metadata,
        updatedAt: f.updatedAt.toISOString(),
      })),
    ),
  );
}

export async function PUT(req: Request) {
  const guard = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (!guard.ok) return guard.response;

  if (!(await rateLimit(guard.actor.id, "feature_flag.toggle", 60, 60))) {
    return jsonError(429, err("RATE_LIMITED", "Too many requests"));
  }

  const body = await req.json().catch(() => null);
  const parsed = featureFlagUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
    );
  }

  const previous = await prisma.featureFlag.findUnique({
    where: { key: parsed.data.key },
  });

  const metadata = parsed.data.metadata as Prisma.InputJsonValue | undefined;
  const upserted = await prisma.featureFlag.upsert({
    where: { key: parsed.data.key },
    create: {
      key: parsed.data.key,
      enabled: parsed.data.enabled,
      ...(metadata !== undefined ? { metadata } : {}),
    },
    update: {
      enabled: parsed.data.enabled,
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });

  await logAudit({
    userId: guard.actor.id,
    action: "feature_flag.toggle",
    resourceType: "feature_flag",
    resourceId: upserted.key,
    ipAddress: guard.ip ?? undefined,
    metadata: {
      previousEnabled: previous?.enabled ?? null,
      nextEnabled: upserted.enabled,
    },
  });

  return NextResponse.json(
    ok({
      key: upserted.key,
      enabled: upserted.enabled,
      updatedAt: upserted.updatedAt.toISOString(),
    }),
  );
}
