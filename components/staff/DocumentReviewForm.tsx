"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Two-button approve/reject form. Reject opens a textarea that requires at
// least 10 chars (matched by /api/staff/documents/[id]/reject server-side).
// On success we route back to the queue so the next pending doc surfaces.

const MIN_REJECTION_REASON = 10;

export function DocumentReviewForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  function call(method: "approve" | "reject", body?: object) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/staff/documents/${documentId}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Request failed (${res.status})`);
          return;
        }
        router.push("/staff/documents");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  function onReject(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REJECTION_REASON) {
      setError(`Reason must be at least ${MIN_REJECTION_REASON} characters`);
      return;
    }
    call("reject", { reason: trimmed });
  }

  if (showReject) {
    return (
      <form onSubmit={onReject} className="space-y-3">
        <div className="grid gap-1">
          <label htmlFor="reject-reason" className="text-xs font-medium uppercase text-muted-foreground">
            Rejection reason (required, min {MIN_REJECTION_REASON} chars)
          </label>
          <textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this document is being rejected..."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            maxLength={2000}
            required
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground">{reason.trim().length} characters</span>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Rejecting..." : "Confirm reject"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowReject(false);
              setReason("");
              setError(null);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="success"
          onClick={() => call("approve")}
          disabled={pending}
        >
          {pending ? "Approving..." : "Approve"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setShowReject(true)}
          disabled={pending}
        >
          Reject...
        </Button>
      </div>
    </div>
  );
}
