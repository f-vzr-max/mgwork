"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Wordmark } from "./wordmark";
import { Badge } from "./badge";
import { Hairline } from "./hairline";
import { Stack } from "./stack";
import { Button } from "./button";
import { Icon } from "./icon";
import { LanguageMenu } from "./language-menu";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export type PublicNavKey = "candidats" | "entreprises" | "conformite" | "tarifs" | null;

interface NavLink {
  key: Exclude<PublicNavKey, null>;
  labelKey: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { key: "candidats", labelKey: "nav.candidats", href: "/candidats" },
  { key: "entreprises", labelKey: "nav.entreprises", href: "/entreprises" },
  { key: "conformite", labelKey: "nav.conformite", href: "/conformite" },
  { key: "tarifs", labelKey: "nav.tarifs", href: "/tarifs" },
];

export interface PublicShellProps {
  active?: PublicNavKey;
  children: React.ReactNode;
}

function NavLinkItem({
  link,
  label,
  isActive,
  onNavigate,
}: {
  link: NavLink;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "text-[15px] leading-tight tracking-[-0.01em] no-underline pb-1 border-b-2 transition-colors",
        isActive
          ? "border-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary))]"
          : "border-transparent font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]",
      )}
    >
      {label}
    </Link>
  );
}

export function PublicHeader({ active = null }: { active?: PublicNavKey }) {
  const t = useTranslations("marketing");
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <header className="sticky top-0 z-20 flex items-center h-16 md:h-[100px] border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 md:px-8">
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 md:gap-8">
        <Link href="/" className="no-underline shrink-0">
          <Wordmark size={28} />
        </Link>

        {/* Desktop nav (md+) */}
        <nav
          className="hidden md:flex shrink-0 items-center gap-7"
          aria-label={t("nav.sectionsAria")}
        >
          {NAV_LINKS.map((l) => (
            <NavLinkItem key={l.key} link={l} label={t(l.labelKey)} isActive={l.key === active} />
          ))}
        </nav>

        {/* Desktop right-side actions (md+) */}
        <div className="hidden md:flex shrink-0 items-center gap-2">
          <LanguageMenu />
          <ThemeToggle />
          <Link href="/sign-in" className="no-underline">
            <Button variant="ghost">{t("nav.signIn")}</Button>
          </Link>
          <Link href="/sign-up" className="no-underline">
            <Button>{t("nav.signUp")}</Button>
          </Link>
        </div>

        {/* Mobile burger (< md) */}
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={t("nav.openMenu")}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <Icon name="menu" size={20} aria-hidden />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
            <Dialog.Content
              className="fixed right-0 top-0 z-50 flex h-full w-[88vw] max-w-[360px] flex-col bg-[hsl(var(--background))] border-l border-[hsl(var(--border))] shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
              aria-describedby={undefined}
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--border))]">
                <Dialog.Title asChild>
                  <Wordmark size={24} />
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label={t("nav.closeMenu")}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] transition-colors"
                  >
                    <Icon name="x" size={20} aria-hidden />
                  </button>
                </Dialog.Close>
              </div>
              <nav
                className="flex flex-col gap-5 px-6 py-6"
                aria-label={t("nav.sectionsAria")}
              >
                {NAV_LINKS.map((l) => (
                  <NavLinkItem
                    key={l.key}
                    link={l}
                    label={t(l.labelKey)}
                    isActive={l.key === active}
                    onNavigate={close}
                  />
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-4 px-6 pb-6 border-t border-[hsl(var(--border))] pt-6">
                <div className="flex items-center justify-between">
                  <LanguageMenu />
                  <ThemeToggle />
                </div>
                <Link href="/sign-in" className="no-underline" onClick={close}>
                  <Button variant="ghost" className="w-full">
                    {t("nav.signIn")}
                  </Button>
                </Link>
                <Link href="/sign-up" className="no-underline" onClick={close}>
                  <Button className="w-full">{t("nav.signUp")}</Button>
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}

interface FooterCol {
  titleKey: string;
  links: { labelKey: string; href: string }[];
}

// Only ship links that resolve to a real page. Placeholder "#" hrefs were
// removed as part of the 2026-05-20 audit (F-007) — they were both a UX wart
// and a legal-compliance risk (Mentions légales, Confidentialité).
const FOOTER_COLS: FooterCol[] = [
  {
    titleKey: "footer.colProduit",
    links: [
      { labelKey: "footer.links.candidats", href: "/candidats" },
      { labelKey: "footer.links.entreprises", href: "/entreprises" },
      { labelKey: "footer.links.tarifs", href: "/tarifs" },
      { labelKey: "footer.links.security", href: "/conformite" },
    ],
  },
  {
    titleKey: "footer.colRessources",
    links: [
      { labelKey: "footer.links.guideCandidat", href: "/guides/candidat" },
      { labelKey: "footer.links.guideEntreprise", href: "/guides/entreprise" },
      { labelKey: "footer.links.helpCenter", href: "/aide" },
    ],
  },
  {
    titleKey: "footer.colEntreprise",
    links: [{ labelKey: "footer.links.contact", href: "/contact" }],
  },
  {
    titleKey: "footer.colLegal",
    links: [
      { labelKey: "footer.links.mentionsLegales", href: "/legal/mentions-legales" },
      { labelKey: "footer.links.confidentialite", href: "/legal/confidentialite" },
      { labelKey: "footer.links.conditions", href: "/legal/conditions" },
      { labelKey: "footer.links.dpa", href: "/conformite" },
      { labelKey: "footer.links.cookies", href: "/legal/cookies" },
    ],
  },
];

export function PublicFooter() {
  const t = useTranslations("marketing");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[hsl(var(--surface-2))] border-t border-[hsl(var(--border))]">
      <div className="mx-auto w-full max-w-[1120px] px-4 md:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)] gap-10 md:gap-12">
          <div className="sm:col-span-2 md:col-span-1">
            <Wordmark size={26} />
            <p
              className="mg-body-sm mt-4 mb-5 max-w-[280px]"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {t("footer.tagline")}
            </p>
            <Stack dir="row" gap={8} align="center" wrap>
              <Badge tone="success" icon="shield-check">
                {t("footer.badge.dpa")}
              </Badge>
              <LanguageMenu />
            </Stack>
          </div>
          {FOOTER_COLS.map((c) => (
            <div key={c.titleKey}>
              <div
                className="mg-micro mb-3.5"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {t(c.titleKey)}
              </div>
              <Stack gap={10}>
                {c.links.map((l) => (
                  <Link
                    key={l.labelKey}
                    href={l.href}
                    className="mg-body-sm no-underline text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                  >
                    {t(l.labelKey)}
                  </Link>
                ))}
              </Stack>
            </div>
          ))}
        </div>
        <Hairline style={{ margin: "32px 0 16px" }} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("footer.copyright", { year })}
          </div>
          {/* Social links removed pending real accounts (audit F-007). */}
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ active = null, children }: PublicShellProps) {
  return (
    <div className="mg-root flex min-h-screen w-full flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <PublicHeader active={active} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

export default PublicShell;
