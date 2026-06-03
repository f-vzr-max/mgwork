import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ROLES, type Role } from "@/lib/roles";

/**
 * Login-time DB -> Clerk role reconcile.
 *
 * User.role in the database is authoritative (written by the admin role-update
 * endpoint and the Clerk webhook). Clerk publicMetadata.role can drift out of
 * sync because the webhook only syncs Clerk -> DB, never the reverse, which
 * strands a user when Clerk holds a stale or invalid role (e.g. the
 * Clerk-instance default "USER"), routing them to "/undefined" or the
 * onboarding fallback even though the DB knows their real role.
 *
 * This reads the authoritative DB role for clerkUserId and, if Clerk's
 * publicMetadata.role diverges, pushes the DB role into Clerk so middleware and
 * the JWT observe the correct value from the next request on. It is idempotent
 * and side-effect-free when the two already agree, and never throws on a Clerk
 * failure (the DB role is still returned so routing can proceed).
 *
 * @returns the authoritative DB role, or undefined if the user has no DB row.
 */
export async function reconcileRoleFromDb(
  clerkUserId: string,
): Promise<Role | undefined> {
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { role: true },
  });
  if (!dbUser) return undefined;

  const dbRole = dbUser.role as Role;
  if (!(ROLES as readonly string[]).includes(dbRole)) return undefined;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    if (user.publicMetadata?.role !== dbRole) {
      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { role: dbRole },
      });
    }
  } catch (e) {
    console.error("[role-reconcile] failed to sync DB role to Clerk", e);
  }

  return dbRole;
}
