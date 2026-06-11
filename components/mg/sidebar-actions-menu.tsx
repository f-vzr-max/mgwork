"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { Icon } from "./icon";

export interface SidebarActionsMenuProps {
  className?: string;
}

// Direct one-click logout. This used to be a three-dot menu whose only item
// was "logout" — the toggle carried the logout aria-label, so users (and
// audits) clicked it repeatedly without ever reaching the real action.
export function SidebarActionsMenu({ className }: SidebarActionsMenuProps) {
  const t = useTranslations();
  const { signOut } = useClerk();
  const [pending, setPending] = React.useState(false);

  function onLogout() {
    if (pending) return;
    setPending(true);
    void signOut({ redirectUrl: "/" });
  }

  return (
    <button
      type="button"
      aria-label={t("mg.actions.logout")}
      title={t("mg.actions.logout")}
      onClick={onLogout}
      disabled={pending}
      className={
        className
          ? `${className} hover:bg-[hsl(var(--surface-2))] transition-colors`
          : "hover:bg-[hsl(var(--surface-2))] transition-colors"
      }
      style={{
        border: 0,
        background: "transparent",
        color: "hsl(var(--muted-foreground))",
        padding: 4,
        cursor: pending ? "wait" : "pointer",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Icon name="log-out" size={16} />
    </button>
  );
}

export default SidebarActionsMenu;
