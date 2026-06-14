import * as React from "react";
import { Badge, type BadgeProps, type BadgeTone } from "./badge";
import { type IconName } from "./icon";

// Canonical status enum used across the app. Each entry maps to (tone, icon,
// French default label). The label is overridable for translated copy.
export type StatusKey =
  | "OK"
  | "APPROVED"
  | "DEPLOYED"
  | "COMPLETED"
  | "PAID"
  | "ACTIVE"
  | "ALERT"
  | "EXPIRING_SOON"
  | "PAUSED"
  | "OVERDUE"
  | "INTERVENTION_REQUIRED"
  | "REJECTED"
  | "EXPIRED"
  | "FAILED"
  | "PENDING"
  | "APPLIED"
  | "SHORTLISTED"
  | "ACCEPTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_DONE"
  | "OFFER_MADE"
  | "DRAFT"
  | "CLOSED";

type Tuple = readonly [BadgeTone, IconName, string];

const STATUS_TONE: Record<StatusKey, Tuple> = {
  OK: ["success", "check-circle-2", "OK"],
  APPROVED: ["success", "check-circle-2", "Approuvé"],
  DEPLOYED: ["success", "check-circle-2", "Déployé"],
  COMPLETED: ["success", "check-circle-2", "Terminé"],
  PAID: ["success", "check-circle-2", "Payé"],
  ACTIVE: ["success", "check-circle-2", "Actif"],
  ALERT: ["warning", "alert-triangle", "Alerte"],
  EXPIRING_SOON: ["warning", "alert-triangle", "Bientôt expiré"],
  PAUSED: ["warning", "alert-triangle", "En pause"],
  OVERDUE: ["warning", "alert-triangle", "En retard"],
  INTERVENTION_REQUIRED: ["danger", "octagon-alert", "Intervention"],
  REJECTED: ["danger", "octagon-alert", "Refusé"],
  EXPIRED: ["danger", "octagon-alert", "Expiré"],
  FAILED: ["danger", "octagon-alert", "Échec"],
  PENDING: ["info", "clock", "En attente"],
  APPLIED: ["info", "circle-dot", "Postulé"],
  SHORTLISTED: ["info", "circle-dot", "Présélectionné"],
  ACCEPTED: ["success", "check-circle-2", "Accepté"],
  INTERVIEW_SCHEDULED: ["info", "calendar", "Entretien"],
  INTERVIEW_DONE: ["info", "check-circle-2", "Entretien fait"],
  OFFER_MADE: ["info", "circle-dot", "Offre envoyée"],
  DRAFT: ["neutral", "circle-dashed", "Brouillon"],
  CLOSED: ["neutral", "circle-dashed", "Fermé"],
};

export interface StatusBadgeProps extends Omit<BadgeProps, "tone" | "icon" | "children"> {
  status: StatusKey | string;
  label?: string;
}

export function StatusBadge({ status, label, size = "sm", ...rest }: StatusBadgeProps) {
  const entry = (STATUS_TONE as Record<string, Tuple>)[status];
  const [tone, icon, defaultLabel] = entry ?? (["neutral", "circle-dashed", status] as Tuple);
  return (
    <Badge tone={tone} size={size} icon={icon} {...rest}>
      {label ?? defaultLabel}
    </Badge>
  );
}

export function statusLabel(status: StatusKey | string, tStatus: (key: string) => string): string {
  return tStatus(status as StatusKey);
}

export default StatusBadge;
