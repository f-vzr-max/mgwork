"use client";

// Reloads the Clerk session (so the JWT picks up the freshly-promoted
// publicMetadata.role) then navigates to the role-specific onboarding screen.
//
// Used by /onboarding when the role has just been promoted from
// unsafeMetadata to publicMetadata server-side. Without the reload the
// middleware would still see the old token and bounce role-protected paths.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

export type OnboardingRedirectorProps = {
  role: "CANDIDATE" | "ENTERPRISE";
};

export function OnboardingRedirector({ role }: OnboardingRedirectorProps) {
  const router = useRouter();
  const { session } = useClerk();
  const t = useTranslations();

  React.useEffect(() => {
    let cancelled = false;
    const target =
      role === "CANDIDATE" ? "/onboarding/candidate" : "/onboarding/enterprise";
    (async () => {
      try {
        await session?.reload();
      } finally {
        if (!cancelled) router.replace(target);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, session, role]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <p className="text-sm text-muted-foreground">
        {t("onboarding.redirector.message")}
      </p>
    </div>
  );
}
