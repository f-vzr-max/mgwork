"use client";

// Candidate-side advisor chat panel, redesigned to match
// `CandidateChatArtboard`. Reuses the existing `/api/chat` SSE stream + the
// transcript shape from `lib/social/llm-bridge`. Quick-prompt chips push text
// straight into the composer; Enter sends, Shift+Enter inserts a newline.
//
// We deliberately do NOT reuse `components/chat/Thread.tsx` here because the
// mobile artboard uses asymmetric bubble corners + an advisor header — the
// shared Thread component would visually drift from the design. The send
// pipeline (SSE chunks → assistant bubble) mirrors `chat-panel.tsx` from the
// previous iteration.

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Avatar,
  Button,
  Icon,
  Stack,
} from "@/components/mg";

const MAX_LENGTH = 4000;

type ChatLang = "FR" | "EN" | "MG";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
};

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
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const overLimit = text.length > MAX_LENGTH;
  const canSubmit = !pending && text.trim().length > 0 && !overLimit;

  async function send() {
    if (!canSubmit) return;
    const value = text.trim();
    setError(null);
    setPending(true);
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", text: value, at: now }]);
    setText("");

    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value, lang }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat.error.network"));
      setPending(false);
      return;
    }

    if (!res.ok) {
      let detail = t("chat.error.http", { status: res.status });
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body?.error?.message) detail = body.error.message;
      } catch {
        /* ignore */
      }
      setError(detail);
      setPending(false);
      return;
    }

    if (!res.body) {
      setError(t("chat.error.noStream"));
      setPending(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const replyAt = new Date().toISOString();
    let replyText = "";
    let appended = false;

    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = parseSseBlock(block);
        if (!evt) continue;
        if (evt.event === "chunk") {
          replyText += evt.data?.text ?? "";
          if (!appended) {
            appended = true;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", text: replyText, at: replyAt },
            ]);
          } else {
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = {
                role: "assistant",
                text: replyText,
                at: replyAt,
              };
              return next;
            });
          }
        } else if (evt.event === "error") {
          setError(evt.data?.message ?? t("chat.error.stream"));
        }
      }
    }
    setPending(false);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function applyQuickPrompt(p: string) {
    setText((prev) => (prev ? `${prev} ${p}` : p));
    requestAnimationFrame(() => taRef.current?.focus());
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        // Reserve space for the sticky composer (chips + textarea + send btn).
        minHeight: "calc(100dvh - 56px - 64px)",
      }}
    >
      {/* Advisor header --------------------------------------------------- */}
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

      {error && (
        <div
          style={{
            margin: "0 16px 8px",
            borderRadius: 6,
            border: "1px solid hsl(var(--destructive))",
            background: "var(--destructive-bg)",
            color: "hsl(var(--destructive))",
            padding: "8px 12px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Bubble thread --------------------------------------------------- */}
      <div
        style={{
          flex: 1,
          padding: "0 16px 200px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <div
            className="mg-body-sm"
            style={{
              color: "hsl(var(--muted-foreground))",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            {t("chat.emptyState")}
          </div>
        ) : (
          messages.map((m, i) => <ChatBubble key={i} message={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer (quick prompts + textarea + send) --------------------- */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 64,
          background: "hsl(var(--background))",
          borderTop: "1px solid hsl(var(--border))",
          zIndex: 9,
        }}
        className="lg:static lg:border-t-0 lg:mt-4"
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "10px 16px 0",
          }}
        >
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyQuickPrompt(p)}
              style={{
                flex: "0 0 auto",
                padding: "6px 12px",
                borderRadius: 9999,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--surface-2))",
                color: "hsl(var(--foreground))",
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}
        >
          <button
            type="button"
            aria-label={t("chat.attachFile")}
            style={{
              border: 0,
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              padding: 8,
              cursor: "pointer",
            }}
          >
            <Icon name="paperclip" size={20} />
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("chat.composer.placeholder")}
            rows={1}
            maxLength={MAX_LENGTH + 100}
            disabled={pending}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              padding: "10px 14px",
              background: "hsl(var(--surface-2))",
              borderRadius: 20,
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              resize: "none",
            }}
          />
          <Button
            type="submit"
            size="icon"
            iconLeft="send"
            aria-label={t("chat.send")}
            disabled={!canSubmit}
          />
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isMe = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: 16,
          borderBottomRightRadius: isMe ? 4 : 16,
          borderBottomLeftRadius: isMe ? 16 : 4,
          background: isMe ? "hsl(var(--primary))" : "hsl(var(--surface-2))",
          color: isMe ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
          fontSize: 14,
          lineHeight: "20px",
          border: isMe ? "none" : "1px solid hsl(var(--border))",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

function parseSseBlock(block: string): { event: string; data: { text?: string; message?: string } } | null {
  let event = "message";
  let data: string | null = null;
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) {
      data = (data ?? "") + line.slice(5).trim();
    }
  }
  if (data === null) return { event, data: {} };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data: { text: data } };
  }
}
