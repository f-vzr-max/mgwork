"use client";

// Per-user action menu used in the admin user list.
// Buttons hit POST routes; on success, refresh the page to reflect new state.

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROLES, type Role } from "@/lib/roles";

type Props = {
  userId: string;
  email: string;
  role: Role;
};

export function UserActionsMenu({ userId, email, role }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function postJson(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; data?: unknown; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status})`);
        return null;
      }
      return data.data ?? null;
    } finally {
      setBusy(false);
    }
  }

  async function ban(banned: boolean) {
    if (!confirm(`${banned ? "Ban" : "Unban"} ${email}?`)) return;
    const ok = await postJson(`/api/admin/users/${userId}/ban`, { banned });
    if (ok) router.refresh();
  }

  async function changeRole() {
    const next = window.prompt(
      `New role for ${email} (one of: ${ROLES.join(", ")})`,
      role,
    );
    if (!next) return;
    if (!ROLES.includes(next as Role)) {
      setError("Invalid role");
      return;
    }
    const ok = await postJson(`/api/admin/users/${userId}/role`, {
      role: next,
    });
    if (ok) router.refresh();
  }

  async function impersonate() {
    if (!confirm(`Open impersonation for ${email}?`)) return;
    const data = (await postJson(
      `/api/admin/users/${userId}/impersonate`,
      {},
    )) as { url?: string } | null;
    if (data?.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? "..." : "Actions"}
      </Button>
      {open ? (
        <div
          className="absolute right-0 z-10 mt-1 w-48 rounded-md border bg-popover p-1 text-sm shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            href={`/admin/users/${userId}`}
            className="block rounded px-3 py-1.5 hover:bg-accent"
          >
            View detail
          </Link>
          <button
            type="button"
            className="block w-full rounded px-3 py-1.5 text-left hover:bg-accent"
            onClick={() => ban(true)}
          >
            Ban
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-1.5 text-left hover:bg-accent"
            onClick={() => ban(false)}
          >
            Unban
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-1.5 text-left hover:bg-accent"
            onClick={changeRole}
          >
            Change role
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-1.5 text-left hover:bg-accent"
            onClick={impersonate}
          >
            Impersonate
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="absolute right-0 mt-1 max-w-xs rounded border bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
