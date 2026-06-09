"use client";

// Candidate consent control (decision G). Rendered on a SHORTLISTED application
// card: the candidate clicks "Share my profile" to accept the shortlist, which
// advances the Application to ACCEPTED and unlocks their identity to the owning
// enterprise. Inaction keeps them masked — there is no implicit reveal.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./button";

export function ShortlistAccept({ applicationId }: { applicationId: string }) {
  const t = useTranslations("app.candidate.applications.shortlist");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        setError(t("error"));
        setPending(false);
        return;
      }
      // Server component re-reads the now-ACCEPTED status.
      router.refresh();
    } catch {
      setError(t("error"));
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
        {t("hint")}
      </div>
      <div>
        <Button size="sm" onClick={accept} disabled={pending}>
          {pending ? t("pending") : t("cta")}
        </Button>
      </div>
      {error && (
        <div className="mg-caption" style={{ color: "hsl(var(--destructive))" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default ShortlistAccept;
