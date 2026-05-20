"use client";

// MG Work — Enterprise web shell.
//
// Wraps the authenticated enterprise area in the MG `WebSidebar` + `<main>`
// content surface. Active item is derived from the current pathname so any
// page rendered as a child stays in sync without needing prop-drilling.

import * as React from "react";
import { usePathname } from "next/navigation";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";

const NAV: SidebarItem[] = [
  { id: "dashboard", icon: "home", label: "Tableau de bord", href: "/enterprise" },
  { id: "offers", icon: "briefcase", label: "Offres", href: "/enterprise/offers" },
  { id: "candidates", icon: "users", label: "Candidats", href: "/enterprise/candidates" },
  { id: "interviews", icon: "calendar", label: "Entretiens", href: "/enterprise/interviews" },
  { id: "documents", icon: "file-text", label: "Documents", href: "/enterprise/documents" },
];

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
      <WebSidebar role="Entreprise" items={NAV} activeId={activeId} user={user} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default EnterpriseShell;
