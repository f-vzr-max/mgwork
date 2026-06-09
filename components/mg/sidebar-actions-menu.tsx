"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { Icon } from "./icon";

export interface SidebarActionsMenuProps {
  className?: string;
}

export function SidebarActionsMenu({ className }: SidebarActionsMenuProps) {
  const t = useTranslations();
  const { signOut } = useClerk();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onLogout() {
    setOpen(false);
    void signOut({ redirectUrl: "/" });
  }

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("mg.actions.logout")}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-[hsl(var(--surface-2))] transition-colors"
        style={{
          border: 0,
          background: "transparent",
          color: "hsl(var(--muted-foreground))",
          padding: 4,
          cursor: "pointer",
          borderRadius: 4,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <Icon name="more-vertical" size={16} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            minWidth: 140,
            zIndex: 50,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="hover:bg-[hsl(var(--surface-2))] transition-colors"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "hsl(var(--foreground))",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {t("mg.actions.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export default SidebarActionsMenu;
