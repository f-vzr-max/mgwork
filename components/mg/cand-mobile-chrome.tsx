"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { CandAppBar } from "./cand-app-bar";
import { CandTabBar } from "./cand-tab-bar";
import { Icon } from "./icon";
import { Wordmark } from "./wordmark";

export interface CandMobileNavItem {
  id: string;
  label: string;
  href: string;
}

export interface CandMobileChromeProps {
  /** Nav items (labels resolved server-side) shown in the slide-in drawer. */
  navItems: CandMobileNavItem[];
  /** Display name for the app-bar avatar. */
  userName: string;
}

// Client mobile chrome for the candidate area: the sticky `CandAppBar` (whose
// hamburger now opens this drawer), a CSS slide-in drawer that owns the nav +
// "Log out", and the fixed bottom `CandTabBar`. It does NOT render the page
// `children` — the server layout keeps ownership of that subtree, and this
// chrome is shown/hidden purely by the parent's `lg:hidden` wrapper (no JS
// breakpoint, so there is no hydration flip between mobile/desktop trees).
export function CandMobileChrome({ navItems, userName }: CandMobileChromeProps) {
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
    void signOut({ redirectUrl: "/" });
  }

  return (
    <>
      <CandAppBar userName={userName} onMenuClick={() => setOpen(true)} />

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
        aria-label={t("app.candidate.nav.ariaLabel")}
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
              key={item.id}
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

      <CandTabBar />
    </>
  );
}

export default CandMobileChrome;
