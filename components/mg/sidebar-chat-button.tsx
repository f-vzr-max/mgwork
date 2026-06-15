"use client";

// Desktop-sidebar footer button that opens the candidate chat drawer. Lives in
// the candidate shell only (passed into WebSidebar via its `chatButton` prop),
// so the shared WebSidebar never imports useCandChat and other shells stay
// provider-free.

import { useTranslations } from "next-intl";
import { Icon } from "./icon";
import { useCandChat } from "./cand-chat-context";

export function SidebarChatButton() {
  const t = useTranslations("app.candidate.chat");
  const { open, toggleChat } = useCandChat();
  return (
    <button
      type="button"
      aria-label={t("open")}
      aria-pressed={open}
      onClick={toggleChat}
      className="hover:bg-[hsl(var(--surface-2))] transition-colors"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        background: open ? "var(--primary-bg)" : "transparent",
        color: open ? "hsl(var(--primary))" : "hsl(var(--foreground))",
        cursor: "pointer",
      }}
    >
      <Icon name="message-circle" size={18} />
    </button>
  );
}
