// Visual timeline of an Application's status progression.
//
// Server component (no client interactivity). Pure presentation; the order of
// the canonical pipeline is fixed in code so we never accidentally rerender
// out of sequence when the DB returns a status string we don't expect.

import { cn } from "@/lib/utils";

export const PIPELINE_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_DONE",
  "OFFER_MADE",
  "DEPLOYED",
] as const;

export type ApplicationStatus =
  | (typeof PIPELINE_STATUSES)[number]
  | "COMPLETED"
  | "REJECTED";

export type StatusTimelineProps = {
  current: ApplicationStatus;
};

const STATUS_LABELS: Record<(typeof PIPELINE_STATUSES)[number], string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_DONE: "Interview done",
  OFFER_MADE: "Offer made",
  DEPLOYED: "Deployed",
};

export function StatusTimeline({ current }: StatusTimelineProps) {
  if (current === "REJECTED") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Application rejected.
      </div>
    );
  }

  const currentIdx =
    current === "COMPLETED"
      ? PIPELINE_STATUSES.length - 1
      : PIPELINE_STATUSES.indexOf(current);

  return (
    <ol className="flex w-full flex-col gap-1 md:flex-row md:items-center md:gap-0">
      {PIPELINE_STATUSES.map((s, i) => {
        const reached = currentIdx >= i;
        const isCurrent = currentIdx === i;
        return (
          <li
            key={s}
            className="flex flex-1 items-center gap-2 md:flex-col md:items-stretch"
          >
            <div className="flex items-center gap-2 md:flex-col md:items-center">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground",
                  isCurrent && "ring-2 ring-primary ring-offset-2",
                )}
              >
                {i + 1}
              </div>
              {i < PIPELINE_STATUSES.length - 1 && (
                <div
                  className={cn(
                    "h-px w-8 md:h-px md:w-full md:flex-1",
                    reached ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "text-xs",
                reached ? "text-foreground" : "text-muted-foreground",
                isCurrent && "font-semibold",
              )}
            >
              {STATUS_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
