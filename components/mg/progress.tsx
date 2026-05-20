import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger";
  height?: number;
}

export function Progress({
  value = 0,
  max = 100,
  tone = "primary",
  height = 6,
  style,
  ...rest
}: ProgressProps) {
  const color =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
        ? "hsl(var(--warning))"
        : tone === "danger"
          ? "hsl(var(--destructive))"
          : "hsl(var(--primary))";
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{
        height,
        borderRadius: 9999,
        background: "hsl(var(--surface-3))",
        overflow: "hidden",
        width: "100%",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 9999,
          transition: "width 600ms ease-out",
        }}
      />
    </div>
  );
}

export default Progress;
