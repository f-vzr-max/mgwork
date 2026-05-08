"use client";

// Schedule-an-interview form. Client component.
//
// Posts to /api/interviews, then on success navigates to the calendar view.
// Uses native form state — react-hook-form is overkill for this 4-field form
// and we already wrap it with the route's strict zod schema server-side.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type InterviewFormProps = {
  applicationId: string;
  onScheduled?: (interviewId: string) => void;
};

const TYPE_OPTIONS = [
  { value: "VIDEO", label: "Video" },
  { value: "PHONE", label: "Phone" },
  { value: "IN_PERSON", label: "In person" },
] as const;

export function InterviewForm({
  applicationId,
  onScheduled,
}: InterviewFormProps) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [type, setType] = React.useState<(typeof TYPE_OPTIONS)[number]["value"]>(
    "VIDEO",
  );
  const [videoUrl, setVideoUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          type,
          videoUrl: videoUrl ? videoUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) {
        setError(data?.error?.message ?? "Failed to schedule interview.");
        return;
      }
      onScheduled?.(data.data.interviewId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="block text-sm font-medium">
        When
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
          className="mt-1"
        />
      </label>

      <label className="block text-sm font-medium">
        Type
        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as (typeof TYPE_OPTIONS)[number]["value"])
          }
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Video URL (optional)
        <Input
          type="url"
          inputMode="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://meet.example.com/..."
          className="mt-1"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Scheduling…" : "Schedule"}
        </Button>
      </div>
    </form>
  );
}
