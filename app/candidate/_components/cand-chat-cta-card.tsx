"use client";

// Dashboard chat-CTA card. Was a Link to /candidate/chat; now opens the chat
// drawer in place (the route is a redirect). Tiny client island so the
// dashboard page stays a server component.

import { useTranslations } from "next-intl";
import { Button, Card, Icon, Stack } from "@/components/mg";
import { useCandChat } from "@/components/mg/cand-chat-context";

export function CandChatCtaCard({ className }: { className?: string }) {
  const t = useTranslations("app.candidate.dashboard");
  const { openChat } = useCandChat();
  return (
    <Card padding={16} surface={2} className={className}>
      <Stack dir="row" gap={12} align="center">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9999,
            background: "var(--primary-bg)",
            color: "hsl(var(--primary))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="message-circle" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mg-body-sm" style={{ fontWeight: 600 }}>{t("chat.question")}</div>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("chat.responseTime")}
          </div>
        </div>
        <Button variant="outline" size="sm" iconRight="arrow-right" onClick={() => openChat()}>
          {t("chat.writeCta")}
        </Button>
      </Stack>
    </Card>
  );
}
