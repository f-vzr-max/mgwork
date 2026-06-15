"use client";

import * as React from "react";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "./icon";

type Lang = "FR" | "EN";
// MG locale is intentionally hidden in v1 until professional translations land.
const VISIBLE: readonly Lang[] = ["FR", "EN"] as const;

export interface LanguageMenuProps {
  className?: string;
  placement?: "up" | "down";
  align?: "left" | "right";
}

export function LanguageMenu({ className, placement = "down", align = "right" }: LanguageMenuProps) {
  const t = useTranslations();
  const locale = useLocale();
  const current: Lang = locale.toLowerCase() === "en" ? "EN" : "FR";
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function setLang(next: Lang) {
    setOpen(false);
    if (next === current || pending) return;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `mgwork_lang=${next}; path=/; max-age=${oneYear}; samesite=lax`;
    startTransition(async () => {
      try {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ lang: next }),
        });
      } catch {
        // network error — cookie has already been set and reload will pick it up
      }
      window.location.reload();
    });
  }

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("languageToggle.aria")}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="hover:bg-[hsl(var(--surface-2))] transition-colors"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          borderRadius: 9999,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          fontSize: 13,
          fontWeight: 600,
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <Icon name="globe" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
        <span>{current}</span>
        <Icon name="chevron-down" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t("languageToggle.aria")}
          style={{
            position: "absolute",
            ...(placement === "up"
              ? { bottom: "calc(100% + 6px)" }
              : { top: "calc(100% + 6px)" }),
            ...(align === "left" ? { left: 0 } : { right: 0 }),
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            minWidth: 120,
            zIndex: 50,
          }}
        >
          {VISIBLE.map((lang) => {
            const active = lang === current;
            return (
              <button
                key={lang}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setLang(lang)}
                className={
                  active
                    ? undefined
                    : "hover:bg-[hsl(var(--surface-2))] transition-colors"
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: active ? "var(--primary-bg)" : "transparent",
                  color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {t(`languageToggle.${lang.toLowerCase()}`)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageMenu;
