"use client";

// Inline form to mark an invoice paid. Posts to the dedicated mark-paid route.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MarkPaidForm({
  invoiceId,
  defaultMethod,
}: {
  invoiceId: string;
  defaultMethod?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(ev.currentTarget);
    const body = {
      paymentMethod: String(fd.get("paymentMethod") ?? "WIRE"),
      reference: String(fd.get("reference") ?? ""),
    };
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        <span>Payment method</span>
        <select
          name="paymentMethod"
          defaultValue={defaultMethod ?? "WIRE"}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="WIRE">WIRE</option>
          <option value="MOBILE_MONEY">MOBILE_MONEY</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Reference</span>
        <Input name="reference" required placeholder="Bank transfer ref / mobile money txn id" />
      </label>
      {error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button type="submit" variant="success" disabled={busy}>
        {busy ? "Saving..." : "Mark as paid"}
      </Button>
    </form>
  );
}
