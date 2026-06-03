import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { dashboardPathForRole } from "@/lib/roles";
import { reconcileRoleFromDb } from "@/lib/role-reconcile";

export default async function DashboardRouter() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  // DB role is authoritative; this also heals a drifted Clerk
  // publicMetadata.role (e.g. the instance default "USER") on the way through.
  const role = await reconcileRoleFromDb(userId);
  if (!role) redirect("/onboarding");
  redirect(dashboardPathForRole(role));
}
