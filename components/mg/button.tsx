"use client";

import * as React from "react";
import { Icon, type IconName } from "./icon";

export type ButtonVariant =
  | "default"
  | "success"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const BTN_HEIGHT: Record<ButtonSize, number> = { sm: 32, default: 40, lg: 48, icon: 36 };
const BTN_PADX: Record<ButtonSize, number> = { sm: 12, default: 16, lg: 20, icon: 0 };

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
  },
  success: {
    background: "hsl(var(--success))",
    color: "hsl(var(--success-foreground))",
  },
  destructive: {
    background: "hsl(var(--destructive))",
    color: "hsl(var(--destructive-foreground))",
  },
  outline: {
    background: "transparent",
    color: "hsl(var(--foreground))",
    borderColor: "hsl(var(--border))",
  },
  secondary: {
    background: "hsl(var(--surface-2))",
    color: "hsl(var(--foreground))",
    borderColor: "hsl(var(--border))",
  },
  ghost: {
    background: "transparent",
    color: "hsl(var(--foreground))",
  },
  link: {
    background: "transparent",
    color: "hsl(var(--primary))",
    padding: 0,
    height: "auto",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
};

const VARIANT_HOVER: Record<ButtonVariant, string> = {
  default: "hover:brightness-110 active:brightness-95",
  success: "hover:brightness-110 active:brightness-95",
  destructive: "hover:brightness-110 active:brightness-95",
  outline: "hover:bg-[hsl(var(--surface-2))] active:bg-[hsl(var(--muted))]",
  secondary: "hover:bg-[hsl(var(--surface-2))] active:bg-[hsl(var(--muted))]",
  ghost: "hover:bg-[hsl(var(--surface-2))] active:bg-[hsl(var(--muted))]",
  link: "hover:no-underline",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "default",
    iconLeft,
    iconRight,
    fullWidth,
    children,
    style,
    disabled,
    type = "button",
    className,
    ...rest
  },
  ref,
) {
  const base: React.CSSProperties = {
    height: BTN_HEIGHT[size],
    minWidth: size === "icon" ? BTN_HEIGHT[size] : undefined,
    width: fullWidth ? "100%" : undefined,
    padding: `0 ${BTN_PADX[size]}px`,
    borderRadius: size === "sm" ? 6 : 8,
    fontWeight: 600,
    fontSize: size === "sm" ? 13 : 14,
    letterSpacing: "-0.005em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background .12s ease, border-color .12s ease, color .12s ease, box-shadow .12s ease, opacity .12s ease, filter .12s ease",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
    userSelect: "none",
  };

  const iconSize = size === "lg" ? 20 : size === "sm" ? 14 : 16;

  const mergedClassName = [VARIANT_HOVER[variant], FOCUS_RING, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={mergedClassName}
      style={{ ...base, ...VARIANT_STYLES[variant], ...style }}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={iconSize} />}
      {children !== undefined && children !== null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
});

export default Button;
