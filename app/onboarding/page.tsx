// /onboarding — server component that routes the signed-in user based on role.
//
// Behavior:
//   - publicMetadata.role set → redirect to the matching onboarding flow
//     (candidate / enterprise) or to the role's dashboard for staff/admin.
//   - publicMetadata.role missing but unsafeMetadata.role set (i.e. user just
//     finished the sign-up choice and the webhook hasn't landed yet) →
//     promote inline via clerkClient, then render the redirector which
//     reloads the JWT and navigates.
//   - Neither set → calm fallback card.

import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { getCurrentRole } from "@/lib/auth";
import {
  ADMIN_ROLES,
  ROLES,
  STAFF_ROLES,
  dashboardPathForRole,
} from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { OnboardingRedirector } from "@/components/onboarding/OnboardingRedirector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PROMOTABLE_ROLES = new Set<Role>(["CANDIDATE", "ENTERPRISE"]);

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const t = await getTranslations();

  const role = await getCurrentRole();

  if (role === "CANDIDATE") redirect("/onboarding/candidate");
  if (role === "ENTERPRISE") redirect("/onboarding/enterprise");
  if (role && (ADMIN_ROLES.includes(role) || STAFF_ROLES.includes(role))) {
    redirect(dashboardPathForRole(role));
  }

  // No publicMetadata.role yet — try unsafeMetadata.role from sign-up.
  const user = await currentUser();
  const unsafe = user?.unsafeMetadata as { role?: string } | undefined;
  const unsafeRole = unsafe?.role;
  if (
    unsafeRole &&
    (ROLES as readonly string[]).includes(unsafeRole) &&
    PROMOTABLE_ROLES.has(unsafeRole as Role)
  ) {
    const promoted = unsafeRole as "CANDIDATE" | "ENTERPRISE";
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { role: promoted },
      });
    } catch (e) {
      console.error("Failed to promote sign-up role", e);
    }
    return <OnboardingRedirector role={promoted} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("onboarding.router.title")}</CardTitle>
          <CardDescription>{t("onboarding.router.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("onboarding.router.help")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
