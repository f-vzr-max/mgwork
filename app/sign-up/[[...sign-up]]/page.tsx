"use client";

// Sign-up entry — captures the role choice before rendering Clerk's widget.
//
// The chosen role is passed via Clerk `unsafeMetadata`; the webhook promotes
// it to `publicMetadata.role` server-side, and `/onboarding` does the same as
// a sync fallback (so the flow doesn't depend on webhook timing).
//
// Wrapped in the MG public shell (PublicHeader + surface-2 background) for
// chrome consistency with the marketing site.

import * as React from "react";
import { SignUp } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { PublicHeader } from "@/components/mg";

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
      <div
        style={{
          minHeight: "100vh",
          background: "hsl(var(--surface-2))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PublicHeader />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
          }}
        >
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
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(var(--surface-2))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PublicHeader />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
        }}
      >
        <div className="w-full max-w-[440px] space-y-3">
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
            fallbackRedirectUrl="/onboarding"
            signInFallbackRedirectUrl="/onboarding"
          />
        </div>
      </main>
    </div>
  );
}
