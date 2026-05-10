import Link from "next/link";
import { DocumentStatusBadge, StatusBadge, type DocumentStatusValue } from "./StatusBadge";

// Single row inside the FIFO documents queue. Server-renderable; no client JS
// needed. We keep the document type capitalization on the chip so it's quick
// to scan even on a long list.

export type QueueRowProps = {
  documentId: string;
  type: string; // DocumentType enum value
  status: DocumentStatusValue;
  ownerLabel: string; // "John Doe" (candidate) or "ACME Ltd" (enterprise)
  ownerKind: "candidate" | "enterprise";
  createdAt: Date;
  pinned?: boolean;
  pinnedReason?: string;
};

function formatDocType(t: string): string {
  // PASSPORT -> Passport, MEDICAL_AUTHORIZATION -> Medical authorization
  return t
    .toLowerCase()
    .split("_")
    .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function formatRelative(d: Date): string {
  const now = Date.now();
  const ms = now - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function QueueRow({
  documentId,
  type,
  status,
  ownerLabel,
  ownerKind,
  createdAt,
  pinned,
  pinnedReason,
}: QueueRowProps) {
  return (
    <Link
      href={`/staff/documents/${documentId}`}
      className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-accent/50"
    >
      <div className="flex w-32 shrink-0 items-center gap-2">
        <DocumentStatusBadge status={status} />
        {pinned ? <StatusBadge label="Priority" tone="warning" /> : null}
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{formatDocType(type)}</span>
        <span className="text-xs text-muted-foreground">
          {ownerKind === "candidate" ? "Candidate" : "Enterprise"} · {ownerLabel}
        </span>
        {pinned && pinnedReason ? (
          <span className="mt-0.5 text-xs text-amber-700">{pinnedReason}</span>
        ) : null}
      </div>
      <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">{formatRelative(createdAt)}</div>
    </Link>
  );
}
