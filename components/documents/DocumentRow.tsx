"use client";

// Single row in the candidate / enterprise documents list. Renders status
// badges + an expiry pill + a "View" button that requests a 15-min signed
// URL on demand and opens it in a new tab. Pure presentation; the parent
// owns refresh on success/failure.

import * as React from "react";
import { Eye, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isExpired, isExpiringWithin } from "@/lib/dates";
import type { DocumentDto } from "@/lib/documents";

const STATUS_LABEL: Record<DocumentDto["status"], string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

const STATUS_CLASS: Record<DocumentDto["status"], string> = {
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-rose-100 text-rose-900",
  EXPIRED: "bg-zinc-200 text-zinc-700",
};

export type ExpiryPill =
  | { kind: "none" }
  | { kind: "expired" }
  | { kind: "soon"; tone: "red" | "amber"; daysLeft: number; date: Date };

function computeExpiryPill(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): ExpiryPill {
  if (!expiresAt) return { kind: "none" };
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return { kind: "none" };
  if (isExpired(date, now)) return { kind: "expired" };
  if (isExpiringWithin(date, 30, now)) {
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { kind: "soon", tone: "red", daysLeft, date };
  }
  if (isExpiringWithin(date, 90, now)) {
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { kind: "soon", tone: "amber", daysLeft, date };
  }
  return { kind: "none" };
}

function ExpiryPillView({ pill }: { pill: ExpiryPill }): React.ReactElement | null {
  if (pill.kind === "none") return null;
  if (pill.kind === "expired") {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800">
        Expired
      </span>
    );
  }
  const cls =
    pill.tone === "red"
      ? "bg-rose-100 text-rose-900"
      : "bg-amber-100 text-amber-900";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      Expires in {pill.daysLeft} day{pill.daysLeft === 1 ? "" : "s"}
    </span>
  );
}

export type DocumentRowProps = {
  doc: DocumentDto;
};

export function DocumentRow({ doc }: DocumentRowProps): React.ReactElement {
  const [opening, setOpening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pill = computeExpiryPill(doc.expiresAt);

  async function handleView() {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const json = (await res.json()) as
        | { ok: true; data: { url: string; expiresAt: string } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !json.ok) {
        const msg = json && "error" in json ? json.error.message : `HTTP ${res.status}`;
        setError(msg);
        return;
      }
      window.open(json.data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{prettifyType(doc.type)}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_CLASS[doc.status],
            )}
          >
            {STATUS_LABEL[doc.status]}
          </span>
          <ExpiryPillView pill={pill} />
        </div>
        {doc.rejectionNote && doc.status === "REJECTED" ? (
          <p className="text-xs text-rose-700">{doc.rejectionNote}</p>
        ) : null}
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
      <Button variant="outline" size="sm" onClick={handleView} disabled={opening}>
        {opening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        View
      </Button>
    </li>
  );
}

function prettifyType(t: DocumentDto["type"]): string {
  return t
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export { computeExpiryPill };
