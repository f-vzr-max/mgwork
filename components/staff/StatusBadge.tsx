import { cn } from "@/lib/utils";

// Reusable color-coded badge. Used for CheckpointStatus, DocumentStatus,
// ApplicationStatus — anywhere a small pill needs to convey state.
//
// We expose a `tone` prop (semantic) instead of taking raw enum values so
// callers can map their domain enum to a tone explicitly. This keeps the
// component decoupled from any single Prisma enum.

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-foreground",
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

// ---- Domain mappers ------------------------------------------------------

export type CheckpointStatusValue = "OK" | "ALERT" | "INTERVENTION_REQUIRED";

export function checkpointStatusTone(s: CheckpointStatusValue): BadgeTone {
  switch (s) {
    case "OK":
      return "success";
    case "ALERT":
      return "warning";
    case "INTERVENTION_REQUIRED":
      return "danger";
  }
}

export function checkpointStatusLabel(s: CheckpointStatusValue): string {
  switch (s) {
    case "OK":
      return "OK";
    case "ALERT":
      return "Alert";
    case "INTERVENTION_REQUIRED":
      return "Intervention required";
  }
}

export function CheckpointStatusBadge({ status }: { status: CheckpointStatusValue }) {
  return <StatusBadge label={checkpointStatusLabel(status)} tone={checkpointStatusTone(status)} />;
}

export type DocumentStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export function documentStatusTone(s: DocumentStatusValue): BadgeTone {
  switch (s) {
    case "PENDING":
      return "info";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "EXPIRED":
      return "warning";
  }
}

export function DocumentStatusBadge({ status }: { status: DocumentStatusValue }) {
  return <StatusBadge label={status.charAt(0) + status.slice(1).toLowerCase()} tone={documentStatusTone(status)} />;
}
