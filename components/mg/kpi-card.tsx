import * as React from "react";
import { Card } from "./card";
import { Badge, type BadgeTone } from "./badge";
import { Sparkline } from "./sparkline";

export interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: number | string;
  deltaTone?: BadgeTone;
  deltaLabel?: string;
  sparkline?: number[];
  tone?: "primary" | "success" | "danger";
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaTone = "success",
  deltaLabel = "vs sem. dernière",
  sparkline,
  tone = "primary",
}: KpiCardProps) {
  const isUp = deltaTone === "success";
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <span className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
          {label}
        </span>
        {sparkline && <Sparkline data={sparkline} width={88} height={24} tone={tone} />}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          className="mg-tabular"
          style={{ fontSize: 28, lineHeight: "32px", fontWeight: 600, letterSpacing: "-0.015em" }}
        >
          {value}
        </span>
        {unit && (
          <span className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {unit}
          </span>
        )}
      </div>
      {delta != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge tone={deltaTone} size="sm" icon={isUp ? "arrow-up" : "arrow-down"}>
            <span className="mg-tabular">
              {isUp ? "+" : ""}
              {delta}
            </span>
          </Badge>
          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {deltaLabel}
          </span>
        </div>
      )}
    </Card>
  );
}

export default KpiCard;
