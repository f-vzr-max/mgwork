"use client";

import * as React from "react";
import { Card, Icon } from "@/components/mg";

export interface FaqItemProps {
  q: string;
  a?: string;
  /** Initial open state. The user can still toggle. */
  open?: boolean;
}

let idCounter = 0;
function useStableId(prefix: string) {
  const [id] = React.useState(() => `${prefix}-${++idCounter}`);
  return id;
}

export function FaqItem({ q, a, open: defaultOpen = false }: FaqItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const panelId = useStableId("faq-panel");
  const headerId = useStableId("faq-header");

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <button
        type="button"
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between gap-4"
        style={{
          padding: 24,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span className="mg-h4" style={{ margin: 0 }}>
          {q}
        </span>
        <Icon
          name="chevron-down"
          size={18}
          style={{
            color: "hsl(var(--muted-foreground))",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
            flexShrink: 0,
          }}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {a && (
            <p
              className="mg-body-sm"
              style={{
                margin: 0,
                padding: "0 24px 24px",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {a}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default FaqItem;
