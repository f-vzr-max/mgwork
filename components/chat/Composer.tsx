"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 4000;

export function Composer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const charCount = text.length;
  const overLimit = charCount > MAX_LENGTH;
  const canSubmit = !disabled && !pending && text.trim().length > 0 && !overLimit;

  const submit = async () => {
    if (!canSubmit) return;
    const value = text.trim();
    setPending(true);
    try {
      await onSubmit(value);
      setText("");
      // Re-focus the composer for fast follow-up typing.
      requestAnimationFrame(() => taRef.current?.focus());
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form
      className="border-t bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">AsanaoConnect agent</span>
        <span
          className={cn(
            "tabular-nums",
            overLimit ? "text-destructive" : undefined,
          )}
        >
          {charCount} / {MAX_LENGTH}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message. Enter to send, Shift+Enter for newline."
          rows={2}
          maxLength={MAX_LENGTH + 100 /* allow paste-then-trim, but disable submit */}
          disabled={disabled || pending}
          className={cn(
            "min-h-[44px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          aria-label="Send message"
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
