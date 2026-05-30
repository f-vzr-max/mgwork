"use client";

// Notes / status / video URL form for the enterprise side of the interview
// detail page. PATCHes /api/interviews/[id].

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type InterviewNotesFormProps = {
  interviewId: string;
  initialNotes: string;
  initialStatus: string;
  initialVideoUrl: string;
};

const STATUS_OPTIONS = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
] as const;

export function InterviewNotesForm({
  interviewId,
  initialNotes,
  initialStatus,
  initialVideoUrl,
}: InterviewNotesFormProps) {
  const t = useTranslations("app.enterprise");
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes);
  const [status, setStatus] = React.useState(initialStatus);
  const [videoUrl, setVideoUrl] = React.useState(initialVideoUrl);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enterpriseNotes: notes,
          status,
          videoUrl: videoUrl ? videoUrl : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) {
        setError(data?.error?.message ?? t("interviews.notesForm.errorSaveFailed"));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("interviews.notesForm.errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="block text-sm font-medium">
        {t("interviews.notesForm.statusLabel")}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        {t("interviews.notesForm.videoUrlLabel")}
        <Input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder={t("interviews.notesForm.videoUrlPlaceholder")}
          className="mt-1"
        />
      </label>

      <label className="block text-sm font-medium">
        {t("interviews.notesForm.notesLabel")}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={5}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-success">{t("interviews.notesForm.savedSuccess")}</p>}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("interviews.notesForm.savingButton") : t("interviews.notesForm.saveButton")}
        </Button>
      </div>
    </form>
  );
}
