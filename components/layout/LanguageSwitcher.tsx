"use client";

// Language switcher — small dropdown that POSTs to /api/me/language to
// persist the new locale on the User row + Clerk publicMetadata. The cookie
// is also set server-side by the API so the next page request renders in the
// new locale immediately.

import * as React from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  FR: "Français",
  EN: "English",
  MG: "Malagasy",
};

type Props = {
  current?: "FR" | "EN" | "MG";
  className?: string;
};

export function LanguageSwitcher({ current = "FR", className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [value, setValue] = React.useState<"FR" | "EN" | "MG">(current);
  const [error, setError] = React.useState<string | null>(null);

  async function onChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const next = ev.target.value as "FR" | "EN" | "MG";
    if (next === value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/language", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ lang: next }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status})`);
        return;
      }
      setValue(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="sr-only">Language</span>
        <select
          value={value}
          onChange={onChange}
          disabled={busy}
          aria-label="Language"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {(["FR", "EN", "MG"] as const).map((l) => (
            <option key={l} value={l}>
              {LABELS[l]}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <div className="mt-1 text-xs text-destructive">{error}</div>
      ) : null}
    </div>
  );
}
