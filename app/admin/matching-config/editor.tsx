"use client";

// Client editor for the matching-weights config page. Sliders + numeric input,
// PUT to /api/admin/matching-config on save.

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Weights = {
  skills: number;
  languages: number;
  sector: number;
  mobility: number;
  experience: number;
  documents: number;
};

const KEYS: (keyof Weights)[] = [
  "skills",
  "languages",
  "sector",
  "mobility",
  "experience",
  "documents",
];

const LABELS: Record<keyof Weights, string> = {
  skills: "Skills",
  languages: "Languages",
  sector: "Sector",
  mobility: "Mobility",
  experience: "Experience",
  documents: "Documents",
};

export function MatchingConfigEditor({ initial }: { initial: Weights }) {
  const [weights, setWeights] = useState<Weights>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function update(key: keyof Weights, raw: number) {
    const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 0)));
    setWeights((w) => ({ ...w, [key]: v }));
  }

  const total = KEYS.reduce((s, k) => s + weights[k], 0);

  async function onSave() {
    if (total <= 0) {
      setMessage({ tone: "error", text: "At least one weight must be > 0." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/matching-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const json = (await res.json().catch(() => ({}))) as
        | { ok: true; data: { weights: Weights } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg =
          json && "error" in json && json.error?.message ? json.error.message : "Could not save weights";
        setMessage({ tone: "error", text: msg });
        return;
      }
      setMessage({ tone: "ok", text: "Saved." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setWeights({ ...initial });
    setMessage(null);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {KEYS.map((k) => (
          <div key={k} className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
            <label htmlFor={`w-${k}`} className="text-sm font-medium">
              {LABELS[k]}
            </label>
            <input
              id={`w-${k}`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[k]}
              onChange={(e) => update(k, Number(e.target.value))}
              className="w-full"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={weights[k]}
              onChange={(e) => update(k, Number(e.target.value))}
              className="h-9 w-14 rounded-md border border-input bg-background px-2 text-sm text-right"
              aria-label={`${LABELS[k]} weight numeric`}
            />
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        Total weight: <span className="font-medium text-foreground">{total}</span>
        {" "}(scores are normalized — total ≠ 100 is fine)
      </div>

      {message ? (
        <p className={"text-sm " + (message.tone === "ok" ? "text-success" : "text-destructive")}>
          {message.text}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save weights"}
        </Button>
        <Button type="button" variant="outline" onClick={reset} disabled={saving}>
          Reset
        </Button>
      </div>
    </div>
  );
}
