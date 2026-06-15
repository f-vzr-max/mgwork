"use client";

// Candidate chat drawer — push (desktop) / overlay (mobile) presentation.
//
// Two exports the layout wires:
//   - ChatPushShell: client grid wrapping <main>. When the chat is open in
//     "push" mode it sets the boolean attr `data-chat-open` on its root (the
//     globals.css lg cascade then hides page rails + collapses the dash grid)
//     and grows a 360px right track that the ChatDrawer panel fills, so the
//     page content reflows left instead of being overlaid.
//   - ChatDrawer: the panel + scrim. In overlay mode (mobile, or desktop
//     < 1060px) it is fixed over the content; in push mode it lives in the
//     grid's right track.
//
// Transcript trap (plan Finding #1): ChatPanel snapshots initialMessages at
// MOUNT ONLY, so CandChatPanel is mounted only AFTER the transcript GET
// resolves — never before (that would leave the thread permanently empty).

import * as React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/mg";
import { useCandChat } from "@/components/mg/cand-chat-context";
import { CandChatPanel, type ChatMessage, type ChatLang } from "./chat-panel";

const PANEL_WIDTH = 360;

export function ChatPushShell({ children }: { children: React.ReactNode }) {
  const { open, chatMode } = useCandChat();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const pushing = open && chatMode === "push";

  // Imperative attribute toggle (not a rendered prop) so the cascade fires
  // without an extra render cycle, per the locked contract.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (pushing) el.setAttribute("data-chat-open", "");
    else el.removeAttribute("data-chat-open");
  }, [pushing]);

  return (
    <div
      ref={ref}
      className="cand-push-shell flex-1 lg:grid"
      style={{
        gridTemplateColumns: pushing ? `minmax(0,1fr) ${PANEL_WIDTH}px` : "minmax(0,1fr)",
      }}
    >
      {children}
      <ChatDrawer pushing={pushing} />
    </div>
  );
}

function ChatDrawer({ pushing }: { pushing: boolean }) {
  const { open, prefill, chatMode, closeChat } = useCandChat();
  const t = useTranslations("app.candidate.chat");

  const [messages, setMessages] = React.useState<ChatMessage[] | null>(null);
  const [lang, setLang] = React.useState<ChatLang | null>(null);
  // Once-guard: the GET fires exactly once for the component's lifetime, even
  // across a fast open/close/reopen. The dedupe is a ref (not effect deps) so
  // the effect's own setState can't re-run a cleanup that cancels the in-flight
  // request; and closing before it resolves must NOT abort it (else reopen is
  // stuck on the skeleton). Only true unmount cancels.
  const startedRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lazy transcript fetch on first open.
  React.useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    fetch("/api/chat/transcript", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { messages: ChatMessage[]; lang: ChatLang }) => {
        if (!mountedRef.current) return;
        setMessages(data.messages);
        setLang(data.lang);
      })
      .catch(() => {
        if (mountedRef.current) setMessages([]);
      });
  }, [open]);

  // Esc closes.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeChat();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  const overlay = chatMode === "overlay" || !pushing;

  if (!open) return null;

  const panel = (
    <section
      role="dialog"
      aria-modal={overlay ? true : undefined}
      aria-label={t("drawerTitle")}
      style={{
        display: "flex",
        flexDirection: "column",
        height: overlay ? "100%" : "100vh",
        width: overlay ? PANEL_WIDTH : "100%",
        maxWidth: overlay ? "100vw" : undefined,
        background: "hsl(var(--background))",
        borderLeft: "1px solid hsl(var(--border))",
        ...(overlay
          ? {
              position: "fixed" as const,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 45,
              boxShadow: "var(--shadow-lg)",
            }
          : { position: "sticky" as const, top: 0, alignSelf: "start" }),
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 12px 12px 16px",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <span className="mg-body-sm" style={{ fontWeight: 600 }}>
          {t("drawerTitle")}
        </span>
        <button
          type="button"
          aria-label={t("close")}
          onClick={closeChat}
          style={{
            border: 0,
            background: "transparent",
            color: "hsl(var(--muted-foreground))",
            padding: 6,
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {messages === null ? (
          <div
            className="mg-body-sm"
            style={{ color: "hsl(var(--muted-foreground))", textAlign: "center", padding: "24px 16px" }}
          >
            {t("loadingTranscript")}
          </div>
        ) : (
          <CandChatPanel
            initialMessages={messages}
            lang={lang ?? "FR"}
            drawer
            prefill={prefill}
          />
        )}
      </div>
    </section>
  );

  if (!overlay) return panel;

  return (
    <>
      <div
        aria-hidden
        onClick={closeChat}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 30,
        }}
      />
      {panel}
    </>
  );
}
