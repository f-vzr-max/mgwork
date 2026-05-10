"use client";

import * as React from "react";
import { Thread, type ThreadMessage } from "@/components/chat/Thread";
import { Composer } from "@/components/chat/Composer";

type ChatLang = "FR" | "EN" | "MG";

export function ChatPanel({
  initialMessages,
  lang,
}: {
  initialMessages: ThreadMessage[];
  lang: ChatLang;
}) {
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [error, setError] = React.useState<string | null>(null);

  const send = async (text: string) => {
    setError(null);
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", text, at: now }]);

    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return;
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body?.error?.message) detail = body.error.message;
      } catch {
        /* ignore */
      }
      setError(detail);
      return;
    }

    if (!res.body) {
      setError("No response stream");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const replyAt = new Date().toISOString();
    let replyText = "";
    let appended = false;

    // SSE parser — accumulate until \n\n boundary.
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
          setError(evt.data?.message ?? "Stream error");
        } else if (evt.event === "done") {
          // nothing
        }
      }
    }
  };

  return (
    <>
      {error ? (
        <div className="mx-4 mt-3 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Thread messages={messages} />
      <Composer onSubmit={send} />
    </>
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
