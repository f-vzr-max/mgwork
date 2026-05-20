"use client";

// MG Work — Admin web shell.
//
// Mirrors components/layout/enterprise-shell.tsx but routes for the platform
// admin area. Active sidebar item is derived from the current pathname so any
// admin page rendered as a child stays in sync without prop drilling.

import * as React from "react";
import { usePathname } from "next/navigation";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";

const NAV: SidebarItem[] = [
  { id: "overview", icon: "home", label: "Vue d'ensemble", href: "/admin" },
  { section: "Plateforme" },
  { id: "users", icon: "users", label: "Utilisateurs", href: "/admin/users" },
  { id: "matching", icon: "sliders", label: "Matching", href: "/admin/matching-config" },
  { id: "disputes", icon: "octagon-alert", label: "Litiges", href: "/admin/disputes" },
  { section: "Conformité & finance" },
  { id: "audit", icon: "shield-check", label: "Journal d'audit", href: "/admin/audit" },
  { id: "invoices", icon: "file-text", label: "Factures", href: "/admin/invoices" },
  { id: "i18n", icon: "globe", label: "Traductions", href: "/admin/i18n" },
  { id: "flags", icon: "settings", label: "Feature flags", href: "/admin/feature-flags" },
];

function resolveActiveId(pathname: string | null): string {
  if (!pathname) return "overview";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/matching-config")) return "matching";
  if (pathname.startsWith("/admin/disputes")) return "disputes";
  if (pathname.startsWith("/admin/audit")) return "audit";
  if (pathname.startsWith("/admin/invoices")) return "invoices";
  if (pathname.startsWith("/admin/i18n")) return "i18n";
  if (pathname.startsWith("/admin/feature-flags")) return "flags";
  return "overview";
}

export interface AdminShellProps {
  user: SidebarUser;
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);

  return (
    <div
      className="mg-root"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "hsl(var(--background))",
      }}
    >
      <WebSidebar role="Admin" items={NAV} activeId={activeId} user={user} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
