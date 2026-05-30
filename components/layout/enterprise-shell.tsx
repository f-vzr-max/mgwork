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

function resolveActiveId(pathname: string | null): string {
  if (!pathname) return "dashboard";
  if (pathname.startsWith("/enterprise/offers")) return "offers";
  if (pathname.startsWith("/enterprise/candidates")) return "candidates";
  if (pathname.startsWith("/enterprise/interviews")) return "interviews";
  if (pathname.startsWith("/enterprise/documents")) return "documents";
  return "dashboard";
}

export interface EnterpriseShellProps {
  user: SidebarUser;
  children: React.ReactNode;
}

export function EnterpriseShell({ user, children }: EnterpriseShellProps) {
  const t = useTranslations("app.enterprise");
  const pathname = usePathname();
  const activeId = resolveActiveId(pathname);
  const NAV: SidebarItem[] = [
    { id: "dashboard", icon: "home", label: t("nav.dashboard"), href: "/enterprise" },
    { id: "offers", icon: "briefcase", label: t("nav.offers"), href: "/enterprise/offers" },
    { id: "candidates", icon: "users", label: t("nav.candidates"), href: "/enterprise/candidates" },
    { id: "interviews", icon: "calendar", label: t("nav.interviews"), href: "/enterprise/interviews" },
    { id: "documents", icon: "file-text", label: t("nav.documents"), href: "/enterprise/documents" },
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
      <WebSidebar role={t("roleLabel")} items={NAV} activeId={activeId} user={user} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default EnterpriseShell;
