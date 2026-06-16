"use client";

// MG Work — Admin web shell.
//
// Mirrors components/layout/enterprise-shell.tsx but routes for the platform
// admin area. Active sidebar item is derived from the current pathname so any
// admin page rendered as a child stays in sync without prop drilling.

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";
import { MobileShell, type MobileNavItem } from "@/components/mg/mobile-shell";

function resolveActiveId(pathname: string | null): string {
  if (!pathname) return "overview";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/matching-config")) return "matching";
  if (pathname.startsWith("/admin/disputes")) return "disputes";
  if (pathname.startsWith("/admin/audit")) return "audit";
  if (pathname.startsWith("/admin/invoices")) return "invoices";
  if (pathname.startsWith("/admin/i18n")) return "i18n";
  if (pathname.startsWith("/admin/feature-flags")) return "flags";
  if (pathname.startsWith("/admin/pending-deletions")) return "pendingDeletions";
  return "overview";
}

export interface AdminShellProps {
  user: SidebarUser;
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const t = useTranslations("app.admin");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);
  const NAV: SidebarItem[] = [
    { id: "overview", icon: "home", label: t("nav.overview"), href: "/admin" },
    { section: t("nav.section.platform") },
    { id: "users", icon: "users", label: t("nav.users"), href: "/admin/users" },
    { id: "matching", icon: "sliders", label: t("nav.matching"), href: "/admin/matching-config" },
    { id: "disputes", icon: "octagon-alert", label: t("nav.disputes"), href: "/admin/disputes" },
    { section: t("nav.section.complianceFinance") },
    { id: "audit", icon: "shield-check", label: t("nav.audit"), href: "/admin/audit" },
    { id: "invoices", icon: "file-text", label: t("nav.invoices"), href: "/admin/invoices" },
    { id: "i18n", icon: "globe", label: t("nav.i18n"), href: "/admin/i18n" },
    { id: "flags", icon: "settings", label: t("nav.flags"), href: "/admin/feature-flags" },
    { id: "pendingDeletions", icon: "user-x", label: t("nav.pendingDeletions"), href: "/admin/pending-deletions" },
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
        <MobileShell navItems={mobileNav} homeHref="/admin" />
      </div>

      {/* Desktop chrome: vertical WebSidebar (hidden below lg). ---------- */}
      <div className="hidden lg:flex" style={{ minHeight: "100vh" }}>
        <WebSidebar role={t("role")} items={NAV} activeId={activeId} user={user} />
      </div>

      {/* Single shared content surface — `children` rendered exactly once. */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
