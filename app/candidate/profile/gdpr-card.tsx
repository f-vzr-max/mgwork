"use client";

// MG Work — GDPR self-service card. Lets the signed-in candidate download a
// JSON copy of their data (Art.20) and request account deletion (Art.17). Both
// endpoints resolve the user from the Clerk session; this card sends no id.
// Rendered by app/candidate/profile/page.tsx below the channels card.

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Stack } from "@/components/mg";

export default function GdprCard(): React.ReactElement {
  const t = useTranslations("app.candidate.profile.gdpr");

  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [requesting, setRequesting] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  async function exportData() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/me/data-export", { credentials: "same-origin" });
      if (!res.ok) {
        setDownloadError(t("exportError"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mgwork-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(t("exportError"));
    } finally {
      setDownloading(false);
    }
  }

  async function requestDeletion() {
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/me/deletion-request", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setRequestError(t("deleteError"));
        return;
      }
      setRequested(true);
    } catch {
      setRequestError(t("deleteError"));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Card padding={20}>
      <div className="mg-h4" style={{ margin: "0 0 4px" }}>{t("title")}</div>
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
        {t("subtitle")}
      </div>

      <Stack dir="row" gap={10} wrap>
        <Button size="sm" variant="outline" iconLeft="download" disabled={downloading} onClick={() => void exportData()}>
          {t("export")}
        </Button>
        <Button size="sm" variant="outline" disabled={requesting || requested} onClick={() => void requestDeletion()}>
          {t("delete")}
        </Button>
      </Stack>

      {downloadError && (
        <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 10 }}>
          {downloadError}
        </div>
      )}
      {requested && (
        <div className="mg-caption" style={{ color: "hsl(var(--success, var(--primary)))", marginTop: 10 }}>
          {t("deleteConfirm")}
        </div>
      )}
      {requestError && (
        <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 10 }}>
          {requestError}
        </div>
      )}
    </Card>
  );
}
