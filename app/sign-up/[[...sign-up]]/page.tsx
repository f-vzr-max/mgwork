"use client";

// Sign-up entry — captures the role choice before rendering Clerk's widget.
//
// The chosen role is passed via Clerk `unsafeMetadata`; the webhook promotes
// it to `publicMetadata.role` server-side, and `/onboarding` does the same as
// a sync fallback (so the flow doesn't depend on webhook timing).

import * as React from "react";
import { SignUp } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/components/LanguageToggle";

type Choice = "CANDIDATE" | "ENTERPRISE";

export default function SignUpPage() {
  const t = useTranslations();
  const [choice, setChoice] = React.useState<Choice | null>(null);

  const choiceCopy: Record<Choice, { title: string; description: string }> = {
    CANDIDATE: {
      title: t("signup.candidate.title"),
      description: t("signup.candidate.description"),
    },
    ENTERPRISE: {
      title: t("signup.enterprise.title"),
      description: t("signup.enterprise.description"),
    },
  };

  if (!choice) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="absolute right-4 top-4">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-3xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("signup.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("signup.subtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(choiceCopy) as Choice[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChoice(c)}
                className="group rounded-lg border bg-card p-6 text-left transition-colors hover:border-brand-blue hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="text-lg font-semibold">
                  {choiceCopy[c].title}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {choiceCopy[c].description}
                </p>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("signup.alreadyHaveAccount")}{" "}
            <a href="/sign-in" className="underline hover:text-foreground">
              {t("signup.signInLink")}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {t("signup.profileLabel")}{" "}
            <span className="font-medium text-foreground">
              {t(
                choice === "CANDIDATE"
                  ? "signup.profileCandidate"
                  : "signup.profileEnterprise",
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="text-muted-foreground underline hover:text-foreground"
          >
            {t("signup.change")}
          </button>
        </div>
        <SignUp
          unsafeMetadata={{ role: choice }}
          afterSignUpUrl="/onboarding"
          afterSignInUrl="/onboarding"
        />
      </div>
    </div>
  );
}
