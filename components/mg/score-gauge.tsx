import * as React from "react";

export function gaugeTone(value: number) {
  if (value >= 80) return { color: "hsl(var(--success))", label: "Très bon match" };
  if (value >= 60) return { color: "hsl(var(--primary))", label: "Bon match" };
  if (value >= 40) return { color: "hsl(var(--warning))", label: "Match partiel" };
  return { color: "hsl(var(--destructive))", label: "Faible match" };
}

export interface ScoreGaugeProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: boolean;
  ariaLabel?: string;
}

export function ScoreGauge({
  value = 0,
  size = 64,
  stroke = 4,
  label,
  ariaLabel,
}: ScoreGaugeProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  const tone = gaugeTone(value);
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Score ${Math.round(value)} sur 100`}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--surface-3))"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone.color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div
        className="mg-tabular"
        style={{
          position: "absolute",
          fontWeight: 600,
          fontSize: Math.round(size * 0.32),
          letterSpacing: "-0.02em",
          color: "hsl(var(--foreground))",
          lineHeight: 1,
        }}
      >
        {Math.round(value)}
        {label !== false && size >= 64 && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "hsl(var(--muted-foreground))",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            /100
          </div>
        )}
      </div>
    </div>
  );
}

export default ScoreGauge;
