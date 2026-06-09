"use client";

// MG Work — Staff web shell.
//
// Mirrors components/layout/enterprise-shell.tsx but routes for the staff
// operations area. Active sidebar item is derived from the current pathname.

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";
import { MobileShell, type MobileNavItem } from "@/components/mg/mobile-shell";

function resolveActiveId(pathname: string | null): string {
  if (!pathname) return "overview";
  if (pathname.startsWith("/staff/documents")) return "documents";
  if (pathname.startsWith("/staff/followup")) return "followup";
  return "overview";
}

export interface StaffShellProps {
  user: SidebarUser;
  children: React.ReactNode;
}

export function StaffShell({ user, children }: StaffShellProps) {
  const t = useTranslations("app.staff");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);
  const NAV: SidebarItem[] = [
    { id: "overview", icon: "home", label: t("nav.overview"), href: "/staff" },
    { id: "documents", icon: "file-text", label: t("nav.documents"), href: "/staff/documents" },
    { id: "followup", icon: "users", label: t("nav.followup"), href: "/staff/followup" },
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
        <MobileShell navItems={mobileNav} homeHref="/staff" />
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

export default StaffShell;
