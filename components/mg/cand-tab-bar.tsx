"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "./icon";

export interface CandTab {
  id: string;
  icon: IconName;
  label: string;
  href: string;
}

const TAB_DEFS: { id: string; icon: IconName; labelKey: string; href: string }[] = [
  { id: "home", icon: "home", labelKey: "tabs.home", href: "/candidate" },
  { id: "docs", icon: "file-text", labelKey: "tabs.docs", href: "/candidate/documents" },
  { id: "jobs", icon: "briefcase", labelKey: "tabs.jobs", href: "/candidate/matches" },
  { id: "apps", icon: "circle-dot", labelKey: "tabs.apps", href: "/candidate/applications" },
  { id: "chat", icon: "message-circle", labelKey: "tabs.chat", href: "/candidate/chat" },
];

function isActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/candidate") return pathname === "/candidate";
  return pathname.startsWith(tabHref);
}

export interface CandTabBarProps {
  tabs?: CandTab[];
}

export function CandTabBar({ tabs }: CandTabBarProps) {
  const t = useTranslations("app.candidate");
  const pathname = usePathname() ?? "/candidate";
  const items: CandTab[] =
    tabs ?? TAB_DEFS.map((d) => ({ id: d.id, icon: d.icon, href: d.href, label: t(d.labelKey) }));
  return (
    <nav
      aria-label={t("nav.ariaLabel")}
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
      {items.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.id}
            href={tab.href}
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
            <Icon name={tab.icon} size={20} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default CandTabBar;
