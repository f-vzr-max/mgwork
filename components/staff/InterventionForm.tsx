"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CHECKPOINT_STATUSES } from "@/lib/validation/staff";

// Client form for creating a Checkpoint on a deployed Application.
//
// Submits to /api/staff/checkpoints (POST). On success, refreshes the
// server route so the timeline above re-renders with the new entry.
// We intentionally do NOT optimistically render the checkpoint locally —
// the server is the source of truth for the timeline ordering.

export function InterventionForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof CHECKPOINT_STATUSES)[number]>("OK");
  const [notes, setNotes] = useState("");
  const [interventionLog, setInterventionLog] = useState("");

  function reset() {
    setNotes("");
    setInterventionLog("");
    setStatus("OK");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      applicationId,
      status,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(interventionLog.trim() ? { interventionLog: interventionLog.trim() } : {}),
    };

    startTransition(async () => {
      try {
        const res = await fetch("/api/staff/checkpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Request failed (${res.status})`);
          return;
        }
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-1">
        <label htmlFor="cp-status" className="text-xs font-medium uppercase text-muted-foreground">
          Status
        </label>
        <select
          id="cp-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={pending}
        >
          {CHECKPOINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <label htmlFor="cp-notes" className="text-xs font-medium uppercase text-muted-foreground">
          Notes
        </label>
        <textarea
          id="cp-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observations, candidate update, employer feedback..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          maxLength={4000}
          disabled={pending}
        />
      </div>

      {status === "INTERVENTION_REQUIRED" ? (
        <div className="grid gap-1">
          <label
            htmlFor="cp-intervention"
            className="text-xs font-medium uppercase text-muted-foreground"
          >
            Intervention log
          </label>
          <textarea
            id="cp-intervention"
            rows={3}
            value={interventionLog}
            onChange={(e) => setInterventionLog(e.target.value)}
            placeholder="What action was taken? Who was contacted?"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            maxLength={4000}
            disabled={pending}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save checkpoint"}
        </Button>
      </div>
    </form>
  );
}
