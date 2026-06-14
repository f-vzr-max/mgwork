// MG Work — Matching weights config (M5).
//
// GET  /api/admin/matching-config   ADMIN | SUPER_ADMIN  → current weights
// PUT  /api/admin/matching-config   ADMIN | SUPER_ADMIN  → upsert weights
//
// Decision (from contracts.md): GET is restricted to admins. We'd considered
// making GET public for transparency, but the weights are tunable knobs that
// directly affect candidate ranking — exposing them lets a savvy candidate
// reverse-engineer the algorithm and pad their profile fields. Keep private.
//
// PUT body: matchingConfigUpdateSchema  → `{ weights: MatchingWeights }`.
// Each weight is bounded 0..100 and the sum must be > 0.
//
// Storage: singleton row in MatchingConfig keyed by id="singleton". See
// lib/matching-config.ts for the upsert helper.

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { matchingConfigUpdateSchema } from "@/lib/validation/admin";
import { getMatchingWeights, setMatchingWeights } from "@/lib/matching-config";
import { err, ok } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

type RequireAdminResult =
  | { ok: true; user: { id: string; role: string } }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" };

async function requireAdmin(clerkId: string): Promise<RequireAdminResult> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) return { ok: false, code: "NOT_FOUND" };
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true, user };
}

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "matching_config.read", 60, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const r = await requireAdmin(clerkId);
  if (!r.ok) {
    return NextResponse.json(
      err(r.code, r.code === "FORBIDDEN" ? "Admin only" : "User not found"),
      { status: r.code === "FORBIDDEN" ? 403 : 404 },
    );
  }

  const weights = await getMatchingWeights();

  // Reads aren't strictly required to audit (no mutation), but contracts.md
  // names the action `matching_config.read` — keep it for the admin trail.
  await logAuditByClerkId(clerkId, {
    action: "matching_config.read",
    resourceType: "matching_config",
    resourceId: "singleton",
    ipAddress: getIp(req),
  });

  return NextResponse.json(ok({ weights }));
}

export async function PUT(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "matching_config.update", 10, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  let parsed;
  try {
    parsed = matchingConfigUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid weights", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  const r = await requireAdmin(clerkId);
  if (!r.ok) {
    return NextResponse.json(
      err(r.code, r.code === "FORBIDDEN" ? "Admin only" : "User not found"),
      { status: r.code === "FORBIDDEN" ? 403 : 404 },
    );
  }

  const saved = await setMatchingWeights(parsed.weights, r.user.id);
  revalidateTag("matching-config");

  await logAuditByClerkId(clerkId, {
    action: "matching_config.update",
    resourceType: "matching_config",
    resourceId: "singleton",
    ipAddress: getIp(req),
    metadata: { weights: saved },
  });

  return NextResponse.json(ok({ weights: saved }));
}
