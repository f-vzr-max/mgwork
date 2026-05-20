"use client";

// MG Work — Staff web shell.
//
// Mirrors components/layout/enterprise-shell.tsx but routes for the staff
// operations area. Active sidebar item is derived from the current pathname.

import * as React from "react";
import { usePathname } from "next/navigation";
import { WebSidebar, type SidebarItem, type SidebarUser } from "@/components/mg";

const NAV: SidebarItem[] = [
  { id: "overview", icon: "home", label: "Vue d'ensemble", href: "/staff" },
  { id: "documents", icon: "file-text", label: "Queue documents", href: "/staff/documents" },
  { id: "followup", icon: "users", label: "Suivi candidats", href: "/staff/followup" },
];

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
      <WebSidebar role="Staff" items={NAV} activeId={activeId} user={user} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

export default StaffShell;
