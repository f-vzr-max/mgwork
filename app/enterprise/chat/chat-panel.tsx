"use client";

// Enterprise-side wrapper around the shared SSE chat panel
// (`components/chat/chat-panel.tsx`). No advisor header — the page renders a
// `PageHeader` — and enterprise-specific quick prompts; all strings live
// under the `assistantChat` i18n namespace.

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChatPanel, type ChatPanelMessage } from "@/components/chat/chat-panel";

type ChatLang = "FR" | "EN" | "MG";

const QUICK_PROMPT_KEYS = [
  "quickPrompts.activeOffers",
  "quickPrompts.pipeline",
  "quickPrompts.shortlists",
  "quickPrompts.writeOffer",
] as const;

export function EnterpriseChatPanel({
  initialMessages,
  lang,
}: {
  initialMessages: ChatPanelMessage[];
  lang: ChatLang;
}) {
  const t = useTranslations("assistantChat");
  return (
    <ChatPanel
      initialMessages={initialMessages}
      lang={lang}
      namespace="assistantChat"
      quickPrompts={QUICK_PROMPT_KEYS.map((k) => t(k))}
      composerOffset={0}
    />
  );
}
