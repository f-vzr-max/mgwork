"use client";

import * as React from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { Wordmark } from "./wordmark";
import { Avatar } from "./avatar";

export interface CandAppBarProps {
  notify?: boolean;
  userName?: string;
  onMenuClick?: () => void;
}

export function CandAppBar({ notify = true, userName = "", onMenuClick }: CandAppBarProps) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: 56,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "hsl(var(--background))",
        borderBottom: "1px solid hsl(var(--border))",
        zIndex: 10,
      }}
    >
      <button
        type="button"
        aria-label="Menu"
        onClick={onMenuClick}
        style={{
          border: 0,
          background: "transparent",
          padding: 6,
          cursor: "pointer",
          color: "hsl(var(--foreground))",
        }}
      >
        <Icon name="menu" size={20} />
      </button>
      <Link href="/candidate" style={{ textDecoration: "none" }}>
        <Wordmark size={16} />
      </Link>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          type="button"
          aria-label="Notifications"
          style={{
            border: 0,
            background: "transparent",
            padding: 6,
            cursor: "pointer",
            color: "hsl(var(--foreground))",
            position: "relative",
          }}
        >
          <Icon name="bell" size={20} />
          {notify && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: "hsl(var(--destructive))",
              }}
            />
          )}
        </button>
        <Avatar name={userName} size={28} />
      </div>
    </div>
  );
}

export default CandAppBar;
