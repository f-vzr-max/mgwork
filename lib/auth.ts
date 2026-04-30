import { auth, currentUser } from "@clerk/nextjs/server";
import type { Role } from "./roles";

// Read role from Clerk publicMetadata. Set this via Clerk dashboard or API.
export async function getCurrentRole(): Promise<Role | undefined> {
  const user = await currentUser();
  const role = user?.publicMetadata?.role as Role | undefined;
  return role;
}

export async function getAuthContext() {
  const { userId } = await auth();
  if (!userId) return { userId: null, role: undefined as Role | undefined };
  const role = await getCurrentRole();
  return { userId, role };
}
