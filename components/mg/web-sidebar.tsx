"use client";

import * as React from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icon";
import { Wordmark } from "./wordmark";
import { Hairline } from "./hairline";
import { Avatar } from "./avatar";
import { Badge, type BadgeTone } from "./badge";

export type SidebarItem =
  | { section: string; id?: undefined }
  | {
      id: string;
      label: string;
      icon: IconName;
      href: string;
      badge?: React.ReactNode;
      badgeTone?: BadgeTone;
      dot?: boolean;
    };

export interface SidebarUser {
  name: string;
  email: string;
}

export interface WebSidebarProps {
  role?: string;
  user?: SidebarUser;
  items: SidebarItem[];
  activeId?: string;
  footer?: React.ReactNode;
  /** Override Wordmark anchor; defaults to "/" */
  homeHref?: string;
}

export function WebSidebar({
  role = "Enterprise",
  user,
  items,
  activeId,
  footer,
  homeHref = "/",
}: WebSidebarProps) {
  return (
    <aside
      style={{
        width: 248,
        flex: "0 0 248px",
        background: "hsl(var(--surface-2))",
        borderRight: "1px solid hsl(var(--border))",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          padding: "24px 18px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Link href={homeHref} style={{ textDecoration: "none" }}>
          <Wordmark size={19} />
        </Link>
        <span className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
          {role}
        </span>
      </div>
      <Hairline />
      <nav style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it, i) => {
          if ("section" in it && it.section) {
            return (
              <div
                key={`section-${i}`}
                className="mg-micro"
                style={{ color: "hsl(var(--muted-foreground))", padding: "12px 8px 4px" }}
              >
                {it.section}
              </div>
            );
          }
          const item = it as Exclude<SidebarItem, { section: string }>;
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                position: "relative",
                height: 32,
                padding: "0 10px",
                background: active ? "var(--primary-bg)" : "transparent",
                color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontWeight: active ? 600 : 500,
                fontSize: 13.5,
                textAlign: "left",
                textDecoration: "none",
              }}
            >
              {active && (
                <span
                  style={{
                    position: "absolute",
                    left: -2,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    borderRadius: 2,
                    background: "hsl(var(--primary))",
                  }}
                />
              )}
              <Icon name={item.icon} size={16} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
              {item.badge != null && (
                <Badge tone={item.badgeTone || "neutral"} size="sm">
                  {item.badge}
                </Badge>
              )}
              {item.dot && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 9999,
                    background: "hsl(var(--destructive))",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <Hairline />
      <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        {user && (
          <>
            <Avatar name={user.name} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="mg-body-sm"
                style={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name}
              </div>
              <div
                className="mg-mono"
                style={{
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </div>
            </div>
            <button
              type="button"
              aria-label="Actions"
              style={{
                border: 0,
                background: "transparent",
                color: "hsl(var(--muted-foreground))",
                padding: 4,
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              <Icon name="more-vertical" size={16} />
            </button>
          </>
        )}
        {!user && footer}
      </div>
    </aside>
  );
}

export default WebSidebar;
