"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Inline composer for creating a private StaffNote on the active resource.
// `resourceType` matches the strings in lib/validation/staff.ts —
// "candidate" | "enterprise" | "application" | "document" | "checkpoint".

export function NoteForm({
  resourceType,
  resourceId,
}: {
  resourceType: "candidate" | "enterprise" | "application" | "document" | "checkpoint";
  resourceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Note cannot be empty");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/staff/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceType, resourceId, note: trimmed }),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Request failed (${res.status})`);
          return;
        }
        setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a private staff note..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        maxLength={4000}
        disabled={pending}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || note.trim().length === 0}>
          {pending ? "Posting..." : "Post note"}
        </Button>
      </div>
    </form>
  );
}
