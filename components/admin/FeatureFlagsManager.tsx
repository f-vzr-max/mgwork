"use client";

// Client-side feature-flag manager. Lists current flags, lets admin toggle
// each, and add new ones. Server-side enforces SUPER_ADMIN for writes —
// non-super-admins will see a 403 toast on toggle.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Flag = { key: string; enabled: boolean; updatedAt: string };

type Props = { initial: Flag[] };

export function FeatureFlagsManager({ initial }: Props) {
  const [flags, setFlags] = React.useState<Flag[]>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [newKey, setNewKey] = React.useState("");
  const [newEnabled, setNewEnabled] = React.useState(false);

  async function upsert(key: string, enabled: boolean) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ key, enabled }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok: boolean;
            data?: { key: string; enabled: boolean; updatedAt: string };
            error?: { message?: string };
          }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status})`);
        return null;
      }
      return data.data ?? null;
    } finally {
      setBusy(null);
    }
  }

  async function toggle(key: string, current: boolean) {
    const data = await upsert(key, !current);
    if (data) {
      setFlags((prev) =>
        prev.map((f) =>
          f.key === key
            ? { key: data.key, enabled: data.enabled, updatedAt: data.updatedAt }
            : f,
        ),
      );
    }
  }

  async function create(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!newKey.trim()) return;
    const data = await upsert(newKey.trim(), newEnabled);
    if (data) {
      setFlags((prev) => {
        const filtered = prev.filter((f) => f.key !== data.key);
        return [
          ...filtered,
          { key: data.key, enabled: data.enabled, updatedAt: data.updatedAt },
        ].sort((a, b) => a.key.localeCompare(b.key));
      });
      setNewKey("");
      setNewEnabled(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold">Add or replace flag</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
          <label className="flex flex-col gap-1 text-sm">
            <span>Key</span>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="ai.match.v2"
              className="w-64"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newEnabled}
              onChange={(e) => setNewEnabled(e.target.checked)}
            />
            Enabled
          </label>
          <Button type="submit" disabled={busy !== null}>
            Save
          </Button>
        </form>
      </div>

      {error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Existing flags</h2>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="p-3">Key</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Updated</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  No feature flags defined yet.
                </td>
              </tr>
            ) : (
              flags.map((f) => (
                <tr key={f.key} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{f.key}</td>
                  <td className="p-3">{f.enabled ? "Yes" : "No"}</td>
                  <td className="p-3 font-mono text-xs">
                    {f.updatedAt.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === f.key}
                      onClick={() => toggle(f.key, f.enabled)}
                    >
                      {busy === f.key ? "..." : f.enabled ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
