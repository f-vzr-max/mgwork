"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Lang = "FR" | "EN";

const LANGS: readonly Lang[] = ["FR", "EN"] as const;

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const locale = useLocale(); // lowercased BCP-47 from <NextIntlClientProvider>
  const current: Lang = locale.toLowerCase() === "en" ? "EN" : "FR";
  const [pending, startTransition] = useTransition();

  function setLang(next: Lang) {
    if (next === current || pending) return;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `mgwork_lang=${next}; path=/; max-age=${oneYear}; samesite=lax`;
    startTransition(async () => {
      try {
        const res = await fetch("/api/locale", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ lang: next }),
        });
        if (!res.ok && process.env.NODE_ENV !== "production") {
          console.warn(`[LanguageToggle] /api/locale returned ${res.status}`);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[LanguageToggle] /api/locale network error", err);
        }
      }
      window.location.reload();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("languageToggle.aria")}
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5 text-xs font-medium",
        className,
      )}
    >
      {LANGS.map((lang) => {
        const active = lang === current;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => setLang(lang)}
            disabled={pending}
            aria-pressed={active}
            className={cn(
              "min-w-[2rem] rounded-sm px-2 py-1 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(lang === "FR" ? "languageToggle.fr" : "languageToggle.en")}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageToggle;
