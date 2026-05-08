// Staff API auth helper.
//
// Centralizes the auth + role-check + actor-resolution pattern used by
// every /api/staff/** route so handlers stay short and we have a single
// place to keep authz consistent.
//
// Usage:
//   const guard = await requireStaffActor(["STAFF_DOCUMENTS"]);
//   if (!guard.ok) return guard.response;
//   const { actor, clerkId } = guard;
//
// `extraAllowedRoles` always implicitly includes ADMIN + SUPER_ADMIN so
// callers don't have to list them every time.

import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { Role } from "./roles";
import { ADMIN_ROLES } from "./roles";

export type StaffActor = {
  id: string;
  clerkId: string;
  role: Role;
  email: string;
};

export type StaffAuthResult =
  | { ok: true; actor: StaffActor; clerkId: string }
  | { ok: false; response: NextResponse };

// Resolves a Clerk userId (already obtained from `auth()` by the caller —
// keep that call in each route so static security audits can grep for it)
// to an internal User row, asserting role membership.
//
// `extraAllowedRoles` always implicitly includes ADMIN + SUPER_ADMIN.
export async function requireStaffActor(
  clerkId: string | null | undefined,
  allowedStaffRoles: Role[],
): Promise<StaffAuthResult> {
  if (!clerkId) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const allowed = new Set<Role>([...allowedStaffRoles, ...ADMIN_ROLES]);
  if (!allowed.has(user.role)) {
    return { ok: false, response: new NextResponse("Forbidden", { status: 403 }) };
  }

  return {
    ok: true,
    actor: { id: user.id, clerkId, role: user.role, email: user.email },
    clerkId,
  };
}

// Extracts the client IP from common proxy headers. Returns null when none are
// present (local dev). Mirrors the helper used in other routes.
export function getRequestIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
