import * as React from "react";

export interface LogoMarqueeProps {
  logos: string[];
  label?: string;
}

/**
 * CSS-only infinite logo marquee. Mobile stacks label above the strip;
 * md+ keeps the label inline to the left.
 */
export function LogoMarquee({ logos, label }: LogoMarqueeProps) {
  const doubled = [...logos, ...logos];
  return (
    <div
      style={{
        background: "var(--surface-2, hsl(var(--surface-2)))",
        borderTop: "1px solid hsl(var(--border))",
        borderBottom: "1px solid hsl(var(--border))",
      }}
    >
      <style>{`
        @keyframes mg-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .mg-marquee-track {
          animation: mg-marquee 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mg-marquee-track { animation: none; transform: none; }
        }
      `}</style>
      <div className="mx-auto max-w-[1120px] px-4 py-6 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
        {label && (
          <span
            className="mg-caption shrink-0"
            style={{
              color: "hsl(var(--muted-foreground))",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        )}
        <div className="overflow-hidden flex-1 w-full">
          <div
            className="mg-marquee-track flex items-center"
            style={{ width: "max-content", gap: 48 }}
          >
            {doubled.map((b, i) => (
              <div
                key={`${b}-${i}`}
                className="mg-micro shrink-0"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  letterSpacing: "0.08em",
                }}
                aria-hidden={i >= logos.length ? true : undefined}
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogoMarquee;
