import * as React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  surface?: 1 | 2 | 3;
  padY?: number;
  inner?: React.CSSProperties;
}

export function Section({
  surface = 1,
  padY = 96,
  inner,
  style,
  children,
  ...rest
}: SectionProps) {
  const bg =
    surface === 2 ? "hsl(var(--surface-2))" : surface === 3 ? "hsl(var(--surface-3))" : "hsl(var(--background))";
  return (
    <section
      style={{
        background: bg,
        padding: `clamp(48px, 8vw, ${padY}px) clamp(16px, 4vw, 32px)`,
        ...style,
      }}
      {...rest}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", ...inner }}>{children}</div>
    </section>
  );
}

export interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
  maxWidth?: number;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  maxWidth = 720,
}: SectionHeaderProps) {
  return (
    <div
      style={{
        textAlign: align,
        marginInline: align === "center" ? "auto" : 0,
        maxWidth,
        marginBottom: 40,
      }}
    >
      {eyebrow && (
        <div className="mg-micro" style={{ color: "hsl(var(--primary))", marginBottom: 12 }}>
          {eyebrow}
        </div>
      )}
      <h2 className="mg-h1" style={{ margin: 0, textWrap: "balance" as React.CSSProperties["textWrap"] }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mg-body-lg" style={{ color: "hsl(var(--muted-foreground))", margin: "12px 0 0" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default Section;
