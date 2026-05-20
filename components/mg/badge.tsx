import * as React from "react";
import { Icon, type IconName } from "./icon";

export type BadgeTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  icon?: IconName;
}

const BADGE_TONE: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: "hsl(var(--foreground))", bg: "var(--neutral-bg)" },
  primary: { fg: "hsl(var(--primary))", bg: "var(--primary-bg)" },
  info: { fg: "hsl(var(--info))", bg: "var(--info-bg)" },
  success: { fg: "hsl(var(--success))", bg: "var(--success-bg)" },
  warning: { fg: "hsl(var(--warning-foreground))", bg: "var(--warning-bg)" },
  danger: { fg: "hsl(var(--destructive))", bg: "var(--destructive-bg)" },
};

export function Badge({
  tone = "neutral",
  size = "sm",
  icon,
  children,
  style,
  ...rest
}: BadgeProps) {
  const t = BADGE_TONE[tone];
  const h = size === "md" ? 24 : 20;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: h,
        padding: "0 8px",
        background: t.bg,
        color: t.fg,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export default Badge;
