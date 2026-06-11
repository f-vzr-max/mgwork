import * as React from "react";

export interface WordmarkProps {
  size?: number;
  role?: string;
}

export function Wordmark({ size = 18, role }: WordmarkProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        fontSize: size,
        lineHeight: 1,
      }}
    >
      <span style={{ color: "hsl(var(--primary))" }}>Asanao</span>
      <span style={{ color: "hsl(var(--foreground))" }}>Connect</span>
      {role && (
        <span
          style={{
            marginLeft: 8,
            color: "hsl(var(--muted-foreground))",
            fontSize: Math.round(size * 0.62),
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            position: "relative",
            top: -2,
          }}
        >
          {role}
        </span>
      )}
    </div>
  );
}

export default Wordmark;
