"use client";

// MG Work — Staff web shell.
//
// Mirrors components/layout/enterprise-shell.tsx but routes for the staff
// operations area. Active sidebar item is derived from the current pathname.

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";

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

  return (
    <div
      className="mg-root"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "hsl(var(--background))",
      }}
    >
      <WebSidebar role={t("role")} items={NAV} activeId={activeId} user={user} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default StaffShell;
