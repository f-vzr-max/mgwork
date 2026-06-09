"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { Icon } from "./icon";
import { Wordmark } from "./wordmark";
import { LanguageMenu } from "./language-menu";

export interface MobileNavItem {
  label: string;
  href: string;
}

export interface MobileShellProps {
  navItems: MobileNavItem[];
  /** Wordmark anchor; defaults to "/". */
  homeHref?: string;
  /** Optional override for the log-out action (defaults to Clerk signOut). */
  onLogout?: () => void;
}

// Reusable mobile chrome: a sticky top app-bar with a hamburger that toggles a
// CSS slide-in drawer (translateX transform). It contains its OWN nav and a
// "Log out" item; it does NOT render the page `children`.
//
// Visibility is the PARENT's responsibility — render this inside a `lg:hidden`
// wrapper. We deliberately do NOT use a JS breakpoint to decide whether to
// mount, so the server keeps ownership of the children subtree and there is no
// hydration flip between mobile/desktop trees.
export function MobileShell({ navItems, homeHref = "/", onLogout }: MobileShellProps) {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const { signOut } = useClerk();
  const [open, setOpen] = React.useState(false);

  // Lock body scroll while the drawer is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    void signOut({ redirectUrl: "/" });
  }

  return (
    <>
      {/* Sticky top app-bar -------------------------------------------- */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: 56,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "hsl(var(--background))",
          borderBottom: "1px solid hsl(var(--border))",
          zIndex: 30,
        }}
      >
        <button
          type="button"
          aria-label={tCommon("aria.menu")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          style={{
            border: 0,
            background: "transparent",
            padding: 6,
            cursor: "pointer",
            color: "hsl(var(--foreground))",
          }}
        >
          <Icon name="menu" size={20} />
        </button>
        <Link href={homeHref} style={{ textDecoration: "none" }}>
          <Wordmark size={16} />
        </Link>
        <LanguageMenu />
      </div>

      {/* Scrim --------------------------------------------------------- */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease",
          zIndex: 40,
        }}
      />

      {/* Slide-in drawer ----------------------------------------------- */}
      <nav
        aria-label={tCommon("aria.menu")}
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: "85vw",
          background: "hsl(var(--background))",
          borderRight: "1px solid hsl(var(--border))",
          boxShadow: open ? "var(--shadow-md)" : "none",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 220ms ease",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 40,
            marginBottom: 8,
          }}
        >
          <Wordmark size={16} />
          <button
            type="button"
            aria-label={tCommon("aria.close")}
            onClick={() => setOpen(false)}
            style={{
              border: 0,
              background: "transparent",
              padding: 6,
              cursor: "pointer",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="hover:bg-[hsl(var(--surface-2))] transition-colors"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 8,
                textDecoration: "none",
                color: "hsl(var(--foreground))",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="hover:bg-[hsl(var(--surface-2))] transition-colors"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            marginTop: 8,
            padding: "10px 12px",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            background: "transparent",
            color: "hsl(var(--foreground))",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {t("mg.actions.logout")}
        </button>
      </nav>
    </>
  );
}

export default MobileShell;
