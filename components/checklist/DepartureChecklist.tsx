"use client";

// Interactive departure checklist. Client component.
//
// Stores its state locally and PATCHes /api/me/departure-checklist on every
// change (debounced). The shape mirrors the zod `departureChecklistSchema`:
//
//   {
//     flight:   { booked, date?, ref? }
//     housing:  { confirmed, address? }
//     emergency:{ contactName?, phone? }
//     packing:  { items: [{ id, label, done }] }
//   }
//
// Defaults: a small starter pack list is created on first open if `initial`
// is empty so candidates have something to tick.

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ChecklistShape = {
  flight?: { booked: boolean; date?: string; ref?: string };
  housing?: { confirmed: boolean; address?: string };
  emergency?: { contactName?: string; phone?: string };
  packing?: { items: { id: string; label: string; done: boolean }[] };
};

export type DepartureChecklistProps = {
  initial?: ChecklistShape | null;
};

const DEFAULT_PACKING: ChecklistShape["packing"] = {
  items: [
    { id: "passport", label: "Passport (with valid visa pages)", done: false },
    { id: "tickets", label: "Flight ticket(s) printed", done: false },
    { id: "medical", label: "Medical authorization", done: false },
    { id: "contract", label: "Signed work contract", done: false },
    { id: "currency", label: "Mauritian rupees / international card", done: false },
    { id: "clothing", label: "Climate-appropriate clothing", done: false },
  ],
};

function withDefaults(initial?: ChecklistShape | null): ChecklistShape {
  return {
    flight: initial?.flight ?? { booked: false },
    housing: initial?.housing ?? { confirmed: false },
    emergency: initial?.emergency ?? {},
    packing: initial?.packing ?? DEFAULT_PACKING,
  };
}

export function DepartureChecklist({ initial }: DepartureChecklistProps) {
  const [state, setState] = React.useState<ChecklistShape>(() =>
    withDefaults(initial),
  );
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = React.useRef<string>(JSON.stringify(state));

  function scheduleSave(next: ChecklistShape) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(next);
    }, 600);
  }

  async function persist(next: ChecklistShape) {
    const serialized = JSON.stringify(next);
    if (serialized === lastSavedRef.current) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/me/departure-checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: next }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      lastSavedRef.current = serialized;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function update(patch: (prev: ChecklistShape) => ChecklistShape) {
    setState((prev) => {
      const next = patch(prev);
      scheduleSave(next);
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <Section title="Flight" status={state.flight?.booked ? "done" : "pending"}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.flight?.booked ?? false}
            onChange={(e) =>
              update((p) => ({
                ...p,
                flight: { ...(p.flight ?? { booked: false }), booked: e.target.checked },
              }))
            }
          />
          Flight booked
        </label>
        <label className="block text-sm">
          Departure date
          <Input
            type="date"
            value={state.flight?.date ?? ""}
            onChange={(e) =>
              update((p) => ({
                ...p,
                flight: { ...(p.flight ?? { booked: false }), date: e.target.value },
              }))
            }
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          Booking reference
          <Input
            value={state.flight?.ref ?? ""}
            onChange={(e) =>
              update((p) => ({
                ...p,
                flight: { ...(p.flight ?? { booked: false }), ref: e.target.value },
              }))
            }
            className="mt-1"
            maxLength={80}
          />
        </label>
      </Section>

      <Section
        title="Housing"
        status={state.housing?.confirmed ? "done" : "pending"}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.housing?.confirmed ?? false}
            onChange={(e) =>
              update((p) => ({
                ...p,
                housing: {
                  ...(p.housing ?? { confirmed: false }),
                  confirmed: e.target.checked,
                },
              }))
            }
          />
          Housing confirmed
        </label>
        <label className="block text-sm">
          Address in Mauritius
          <Input
            value={state.housing?.address ?? ""}
            onChange={(e) =>
              update((p) => ({
                ...p,
                housing: {
                  ...(p.housing ?? { confirmed: false }),
                  address: e.target.value,
                },
              }))
            }
            className="mt-1"
            maxLength={400}
          />
        </label>
      </Section>

      <Section
        title="Emergency contact"
        status={state.emergency?.contactName ? "done" : "pending"}
      >
        <label className="block text-sm">
          Name
          <Input
            value={state.emergency?.contactName ?? ""}
            onChange={(e) =>
              update((p) => ({
                ...p,
                emergency: { ...(p.emergency ?? {}), contactName: e.target.value },
              }))
            }
            className="mt-1"
            maxLength={200}
          />
        </label>
        <label className="block text-sm">
          Phone
          <Input
            value={state.emergency?.phone ?? ""}
            onChange={(e) =>
              update((p) => ({
                ...p,
                emergency: { ...(p.emergency ?? {}), phone: e.target.value },
              }))
            }
            className="mt-1"
            maxLength={40}
          />
        </label>
      </Section>

      <Section
        title="Packing"
        status={
          state.packing && state.packing.items.every((i) => i.done) ? "done" : "pending"
        }
      >
        <ul className="grid gap-1">
          {(state.packing?.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    packing: {
                      items: (p.packing?.items ?? []).map((it) =>
                        it.id === item.id ? { ...it, done: e.target.checked } : it,
                      ),
                    },
                  }))
                }
              />
              <span className={item.done ? "line-through text-muted-foreground" : ""}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            update((p) => ({
              ...p,
              packing: {
                items: [
                  ...(p.packing?.items ?? []),
                  {
                    id: `custom-${Date.now()}`,
                    label: "New item",
                    done: false,
                  },
                ],
              },
            }))
          }
        >
          Add item
        </Button>
      </Section>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved."}
        {saveStatus === "error" && "Save failed — try again."}
      </p>
    </div>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status: "done" | "pending";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={
            status === "done"
              ? "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
              : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {status === "done" ? "Done" : "Pending"}
        </span>
      </header>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}
