import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/roles";

export default async function DashboardRouter() {
  const { userId, role } = await getAuthContext();
  if (!userId) redirect("/sign-in");
  if (!role) redirect("/onboarding");
  redirect(dashboardPathForRole(role));
}
