"use client";

// MG Work — Enterprise web shell.
//
// Wraps the authenticated enterprise area in the MG `WebSidebar` + `<main>`
// content surface. Active item is derived from the current pathname so any
// page rendered as a child stays in sync without needing prop-drilling.

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";
import { MobileShell, type MobileNavItem } from "@/components/mg/mobile-shell";

function resolveActiveId(pathname: string | null): string {
  if (!pathname) return "dashboard";
  if (pathname.startsWith("/enterprise/offers")) return "offers";
  if (pathname.startsWith("/enterprise/candidates")) return "candidates";
  if (pathname.startsWith("/enterprise/interviews")) return "interviews";
  if (pathname.startsWith("/enterprise/documents")) return "documents";
  if (pathname.startsWith("/enterprise/chat")) return "assistant";
  return "dashboard";
}

export interface EnterpriseShellProps {
  user: SidebarUser;
  children: React.ReactNode;
}

export function EnterpriseShell({ user, children }: EnterpriseShellProps) {
  const t = useTranslations("app.enterprise");
  // The assistant strings live in their own namespace (shared with the
  // enterprise chat page) rather than app.enterprise.
  const tAssistant = useTranslations("assistantChat");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);
  const NAV: SidebarItem[] = [
    { id: "dashboard", icon: "home", label: t("nav.dashboard"), href: "/enterprise" },
    { id: "offers", icon: "briefcase", label: t("nav.offers"), href: "/enterprise/offers" },
    { id: "candidates", icon: "users", label: t("nav.candidates"), href: "/enterprise/candidates" },
    { id: "interviews", icon: "calendar", label: t("nav.interviews"), href: "/enterprise/interviews" },
    { id: "documents", icon: "file-text", label: t("nav.documents"), href: "/enterprise/documents" },
    { id: "assistant", icon: "message-circle", label: tAssistant("nav"), href: "/enterprise/chat" },
  ];

  // MobileShell only needs label + href; project the nav items down to that shape.
  const mobileNav: MobileNavItem[] = NAV.filter(
    (it): it is Exclude<SidebarItem, { section: string }> => "id" in it,
  ).map((it) => ({ label: it.label, href: it.href }));

  return (
    <div
      className="mg-root flex flex-col lg:flex-row"
      style={{
        minHeight: "100vh",
        background: "hsl(var(--background))",
      }}
    >
      {/* Mobile + tablet chrome (sticky app-bar + slide-in drawer; hidden at lg+).
          CSS-only toggle — NO inline `display`, so `lg:hidden` wins the cascade. */}
      <div className="lg:hidden">
        <MobileShell navItems={mobileNav} homeHref="/enterprise" />
      </div>

      {/* Desktop chrome: vertical WebSidebar (hidden below lg). ---------- */}
      <div className="hidden lg:flex" style={{ minHeight: "100vh" }}>
        <WebSidebar role={t("roleLabel")} items={NAV} activeId={activeId} user={user} />
      </div>

      {/* Single shared content surface — `children` rendered exactly once. */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default EnterpriseShell;
