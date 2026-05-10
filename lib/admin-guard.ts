// Helpers for admin API routes.
//
// Centralizes the recurring pattern of:
//   1. CSRF check
//   2. auth() resolution
//   3. Role gate (ADMIN/SUPER_ADMIN)
//   4. IP extraction
//
// Returns a typed `{ ok: true, ... }` or a `Response` to short-circuit. Callers
// remain in charge of audit logging because the action key + resourceId are
// route-specific.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import type { Role } from "@/lib/roles";
import { err, type ApiErr } from "@/types/api";

export type AdminGuardOk = {
  ok: true;
  clerkUserId: string;
  actor: {
    id: string;
    clerkId: string;
    email: string;
    role: Role;
  };
  ip: string | null;
};

export type AdminGuardFail = { ok: false; response: Response };

export function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export function jsonError(
  status: number,
  body: ApiErr,
): Response {
  return NextResponse.json(body, { status });
}

/**
 * Verifies CSRF, auth, and that caller has at least one of `allowedRoles`.
 * Returns either a populated context or a Response to short-circuit.
 */
export async function requireAdmin(
  req: Request,
  allowedRoles: Role[],
  options?: { skipCsrf?: boolean },
): Promise<AdminGuardOk | AdminGuardFail> {
  if (!options?.skipCsrf) {
    try {
      assertSameOrigin(req);
    } catch (e) {
      if (e instanceof CsrfError) {
        return {
          ok: false,
          response: jsonError(403, err("FORBIDDEN", "CSRF check failed")),
        };
      }
      throw e;
    }
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return {
      ok: false,
      response: jsonError(401, err("UNAUTHORIZED", "Authentication required")),
    };
  }

  const actor = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });
  if (!actor) {
    return {
      ok: false,
      response: jsonError(401, err("UNAUTHORIZED", "User not provisioned")),
    };
  }

  if (!allowedRoles.includes(actor.role as Role)) {
    return {
      ok: false,
      response: jsonError(403, err("FORBIDDEN", "Role not permitted")),
    };
  }

  return {
    ok: true,
    clerkUserId,
    actor: {
      id: actor.id,
      clerkId: clerkUserId,
      email: actor.email,
      role: actor.role as Role,
    },
    ip: getIp(req),
  };
}
