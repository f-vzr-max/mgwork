"use client";

// Candidate chat drawer — shared state contract (single source of truth).
//
// The drawer replaces the old /candidate/chat full-page route. This context is
// the only place the open/prefill/mode state lives; every Group-E/F file reads
// it through useCandChat().
//
// LOCKED contracts (do not drift — other files depend on these exact names):
//   useCandChat() → { open, prefill, chatMode, openChat, closeChat,
//                     toggleChat, setChatMode }
//     - chatMode: "push" | "overlay" — defaults to "push"; the drawer flips it
//       to "overlay" at open-time when the viewport is too narrow for a push
//       rail (< 1060px) or on mobile.
//     - openChat(prefill?): opens the drawer; an optional prefill seeds the
//       composer ONCE (capped to 500 chars, NEVER auto-sent — see chat-panel).
//   Push-shell root <div> carries class `cand-push-shell` and a boolean attr
//     `data-chat-open` toggled imperatively (setAttribute/removeAttribute) by
//     the drawer — NOT a React-rendered attribute (avoids a render cycle on the
//     cascade that hides the rails).
//   Rail classes the [data-chat-open] cascade targets (globals.css):
//     `cand-page-rail` (all form-page side rails), `cand-dash-rail` + the
//     dashboard grid `cand-dash-grid`.

import * as React from "react";

export type CandChatMode = "push" | "overlay";

export interface CandChatValue {
  open: boolean;
  prefill: string;
  chatMode: CandChatMode;
  openChat: (prefill?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  setChatMode: (m: CandChatMode) => void;
}

const PREFILL_CAP = 500;
// Min viewport for a push rail: 240 sidebar + 360 chat + 460 min content.
// Below this (and on mobile) the drawer opens as an overlay instead.
const PUSH_MIN_WIDTH = 1060;

const CandChatContext = React.createContext<CandChatValue | null>(null);

export function CandChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState("");
  const [chatMode, setChatMode] = React.useState<CandChatMode>("push");

  // Decide push vs overlay synchronously at open-time (read width once; no
  // resize re-eval — documented gap) so the drawer never paints an in-grid
  // push panel on a too-narrow viewport before an effect can downshift it.
  const decideMode = React.useCallback(() => {
    if (typeof window !== "undefined") {
      setChatMode(window.innerWidth < PUSH_MIN_WIDTH ? "overlay" : "push");
    }
  }, []);

  const openChat = React.useCallback(
    (next?: string) => {
      if (next != null) setPrefill(next.slice(0, PREFILL_CAP));
      decideMode();
      setOpen(true);
      // Single-open invariant: opening the chat dismisses the mobile nav drawer
      // (Finding #5). cand-mobile-chrome listens for this.
      window.dispatchEvent(new CustomEvent("mg:close-nav"));
    },
    [decideMode],
  );

  const closeChat = React.useCallback(() => setOpen(false), []);
  const toggleChat = React.useCallback(() => {
    setOpen((v) => {
      if (!v) {
        decideMode();
        window.dispatchEvent(new CustomEvent("mg:close-nav"));
      }
      return !v;
    });
  }, [decideMode]);

  const value = React.useMemo<CandChatValue>(
    () => ({ open, prefill, chatMode, openChat, closeChat, toggleChat, setChatMode }),
    [open, prefill, chatMode, openChat, closeChat, toggleChat],
  );

  return <CandChatContext.Provider value={value}>{children}</CandChatContext.Provider>;
}

export function useCandChat(): CandChatValue {
  const ctx = React.useContext(CandChatContext);
  if (!ctx) throw new Error("useCandChat must be used within CandChatProvider");
  return ctx;
}
