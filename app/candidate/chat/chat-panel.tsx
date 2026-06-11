"use client";

// Candidate-side advisor chat. The SSE send pipeline + bubble thread +
// composer live in the shared `components/chat/chat-panel.tsx` (also used by
// the enterprise assistant); this wrapper keeps the candidate-only chrome —
// the Aina advisor header and the candidate quick prompts — and pins the
// composer above the fixed `CandTabBar` (64px) on mobile.

import * as React from "react";
import { useTranslations } from "next-intl";
import { Avatar, Icon, Stack } from "@/components/mg";
import { ChatPanel, type ChatPanelMessage } from "@/components/chat/chat-panel";

type ChatLang = "FR" | "EN" | "MG";

export type ChatMessage = ChatPanelMessage;

const QUICK_PROMPT_KEYS = [
  "chat.quickPrompts.prepareInterview",
  "chat.quickPrompts.documentFollowUp",
  "chat.quickPrompts.travelConditions",
  "chat.quickPrompts.housingMauritius",
] as const;

export function CandChatPanel({
  initialMessages,
  lang,
}: {
  initialMessages: ChatMessage[];
  lang: ChatLang;
}) {
  const t = useTranslations("app.candidate");
  const quickPrompts = QUICK_PROMPT_KEYS.map((k) => t(k));

  // Advisor header ------------------------------------------------------
  const header = (
    <div style={{ padding: "16px 16px 0" }}>
      <Stack dir="row" gap={12} align="center" style={{ marginBottom: 14 }}>
        <Avatar name="Aina V" size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mg-body-sm" style={{ fontWeight: 600 }}>Aina Volazara</div>
          <div className="mg-caption" style={{ color: "hsl(var(--success))" }}>
            {t("chat.advisorStatus")}
          </div>
        </div>
        <button
          type="button"
          aria-label={t("chat.moreOptions")}
          style={{
            border: 0,
            background: "transparent",
            color: "hsl(var(--muted-foreground))",
            padding: 4,
            cursor: "pointer",
          }}
        >
          <Icon name="more-vertical" size={18} />
        </button>
      </Stack>
    </div>
  );

  return (
    <ChatPanel
      initialMessages={initialMessages}
      lang={lang}
      namespace="app.candidate.chat"
      quickPrompts={quickPrompts}
      header={header}
      composerOffset={64}
    />
  );
}
