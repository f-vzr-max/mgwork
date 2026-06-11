"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  role: "user" | "assistant";
  text: string;
  at: string; // ISO
};

export function Thread({ messages }: { messages: ThreadMessage[] }) {
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Start the conversation. Tell us about yourself.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((m, i) => (
        <Bubble key={i} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({ message }: { message: ThreadMessage }) {
  const isUser = message.role === "user";
  const time = formatTime(message.at);
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <div
          className={cn(
            "mb-0.5 text-[10px] font-medium uppercase tracking-wider",
            isUser ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {isUser ? "You" : "AsanaoConnect agent"}
          {time ? <span className="ml-2 normal-case">{time}</span> : null}
        </div>
        <div className="whitespace-pre-wrap break-words">{message.text}</div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
