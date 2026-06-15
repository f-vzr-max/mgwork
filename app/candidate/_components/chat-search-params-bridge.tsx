"use client";

// Reads ?openChat=1[&prefill=…] on mount and opens the chat drawer. This is
// the ONLY file in the candidate tree that calls useSearchParams() — it must
// stay wrapped in <Suspense> by the layout (App Router requirement) and below
// <CandChatProvider> so the context exists when it fires. Mount-only: the
// CountryGuide deep-link and the /candidate/chat redirect are hard navigations.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useCandChat } from "@/components/mg/cand-chat-context";

export function ChatSearchParamsBridge() {
  const sp = useSearchParams();
  const { openChat } = useCandChat();
  React.useEffect(() => {
    if (sp.get("openChat") === "1") {
      openChat((sp.get("prefill") ?? "").slice(0, 500));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
