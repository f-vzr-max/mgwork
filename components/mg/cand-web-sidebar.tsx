"use client";

// Client wrapper around `WebSidebar` that derives `activeId` from the current
// pathname. Used by the candidate (and enterprise) desktop shells so the
// server layout can stay a server component while the active highlight still
// follows the URL.

import * as React from "react";
import { usePathname } from "next/navigation";
import { WebSidebar, type SidebarItem, type SidebarUser } from "./web-sidebar";
import { SidebarChatButton } from "./sidebar-chat-button";

export interface CandWebSidebarProps {
  role?: string;
  user?: SidebarUser;
  items: SidebarItem[];
  homeHref?: string;
}

function pickActiveId(items: SidebarItem[], pathname: string): string | undefined {
  let best: { id: string; len: number } | undefined;
  for (const it of items) {
    if (!("id" in it) || !it.id) continue;
    const href = it.href;
    if (!href) continue;
    if (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.len) {
        best = { id: it.id, len: href.length };
      }
    }
  }
  return best?.id;
}

export function CandWebSidebar({ role, user, items, homeHref }: CandWebSidebarProps) {
  const pathname = usePathname() ?? "";
  const activeId = pickActiveId(items, pathname);
  return (
    <WebSidebar
      role={role}
      user={user}
      items={items}
      homeHref={homeHref}
      activeId={activeId}
      chatButton={<SidebarChatButton />}
    />
  );
}

export default CandWebSidebar;
