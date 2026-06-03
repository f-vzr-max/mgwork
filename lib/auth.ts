import { auth, currentUser } from "@clerk/nextjs/server";
import { ROLES, type Role } from "./roles";

// Read role from Clerk publicMetadata. Set this via Clerk dashboard or API.
// Validate against the known ROLES: a stale or invalid value (e.g. the Clerk
// instance default "USER") resolves to undefined (no-role) rather than being
// cast straight through, which previously produced an unmapped "/undefined"
// route via dashboardPathForRole.
export async function getCurrentRole(): Promise<Role | undefined> {
  const user = await currentUser();
  const raw = user?.publicMetadata?.role;
  if (typeof raw === "string" && (ROLES as readonly string[]).includes(raw)) {
    return raw as Role;
  }
  return undefined;
}

export async function getAuthContext() {
  const { userId } = await auth();
  if (!userId) return { userId: null, role: undefined as Role | undefined };
  const role = await getCurrentRole();
  return { userId, role };
}
