// /onboarding — server component that routes the signed-in user based on role.
//
// Behavior:
//   - CANDIDATE  → /onboarding/candidate
//   - ENTERPRISE → /onboarding/enterprise
//   - admin / staff roles → /dashboard (their proper area is set by middleware)
//   - role missing → friendly "awaiting role assignment" panel
//
// Notes:
//   - The middleware redirects unsigned-in users to Clerk; we don't repeat that
//     here. We DO double-check userId for safety.
//   - Role is read via lib/auth.ts (currentUser publicMetadata) so this works
//     even when sessionClaims are not configured to include role.

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth";
import { dashboardPathForRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();

  if (role === "CANDIDATE") redirect("/onboarding/candidate");
  if (role === "ENTERPRISE") redirect("/onboarding/enterprise");
  if (role && (ADMIN_ROLES.includes(role) || STAFF_ROLES.includes(role))) {
    redirect(dashboardPathForRole(role));
  }

  // No role yet — show a calm holding screen. The Clerk dashboard / admin team
  // is expected to set publicMetadata.role; once set the user can re-enter.
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Awaiting role assignment</CardTitle>
          <CardDescription>
            Your account has been created. An MG Work admin will assign your
            role shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Once your role is set you&apos;ll be guided through the matching
            onboarding flow. If this takes more than a few hours, reach out to
            the MG Work team.
          </p>
          <p>
            Roles: CANDIDATE, ENTERPRISE, STAFF_FOLLOWUP, STAFF_DOCUMENTS,
            ADMIN, SUPER_ADMIN.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
