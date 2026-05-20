import * as React from "react";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: "primary" | "success" | "danger";
}

export function Sparkline({
  data = [],
  width = 96,
  height = 24,
  tone = "primary",
}: SparklineProps) {
  if (data.length === 0) return null;
  const stroke =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "danger"
        ? "hsl(var(--destructive))"
        : "hsl(var(--primary))";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 3) - 1.5;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
