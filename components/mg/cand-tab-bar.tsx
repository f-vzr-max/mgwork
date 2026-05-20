"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

export interface CandTab {
  id: string;
  icon: IconName;
  label: string;
  href: string;
}

const DEFAULT_TABS: CandTab[] = [
  { id: "home", icon: "home", label: "Accueil", href: "/candidate" },
  { id: "docs", icon: "file-text", label: "Docs", href: "/candidate/documents" },
  { id: "jobs", icon: "briefcase", label: "Offres", href: "/candidate/matches" },
  { id: "apps", icon: "circle-dot", label: "Apps", href: "/candidate/applications" },
  { id: "chat", icon: "message-circle", label: "Chat", href: "/candidate/chat" },
];

function isActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/candidate") return pathname === "/candidate";
  return pathname.startsWith(tabHref);
}

export interface CandTabBarProps {
  tabs?: CandTab[];
}

export function CandTabBar({ tabs = DEFAULT_TABS }: CandTabBarProps) {
  const pathname = usePathname() ?? "/candidate";
  return (
    <nav
      aria-label="Navigation candidat"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        background: "hsl(var(--background))",
        borderTop: "1px solid hsl(var(--border))",
        display: "flex",
        paddingBottom: 8,
        zIndex: 10,
      }}
    >
      {tabs.map((t) => {
        const active = isActive(t.href, pathname);
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              textDecoration: "none",
            }}
          >
            {active && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 24,
                  height: 2,
                  background: "hsl(var(--primary))",
                  borderRadius: 2,
                }}
              />
            )}
            <Icon name={t.icon} size={20} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default CandTabBar;
