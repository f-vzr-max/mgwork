"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Icon } from "./icon";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? (resolvedTheme ?? theme ?? "light") : "light";
  const isDark = current === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      className={className}
      style={{
        height: 36,
        width: 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9999,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        cursor: "pointer",
      }}
    >
      <Icon name={isDark ? "sun" : "moon"} size={16} />
    </button>
  );
}

export default ThemeToggle;
