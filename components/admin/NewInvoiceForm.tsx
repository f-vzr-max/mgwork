"use client";

// Minimal create-invoice form. POSTs JSON to /api/admin/invoices and on
// success redirects to the detail page.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  enterprises: { id: string; companyName: string }[];
};

const CURRENCIES = ["MUR", "MGA", "EUR", "USD"] as const;
const METHODS = ["WIRE", "MOBILE_MONEY"] as const;

export function NewInvoiceForm({ enterprises }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const fd = new FormData(ev.currentTarget);
    const body = {
      enterpriseId: String(fd.get("enterpriseId") ?? ""),
      amount: Number(fd.get("amount") ?? "0"),
      currency: String(fd.get("currency") ?? "MUR"),
      paymentMethod: String(fd.get("paymentMethod") ?? "WIRE"),
      reference: (fd.get("reference") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok: boolean;
            data?: { invoiceId: string };
            error?: { message?: string; fieldErrors?: Record<string, string[]> };
          }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status})`);
        setFieldErrors(data?.error?.fieldErrors ?? {});
        return;
      }
      router.push(`/admin/invoices/${data.data!.invoiceId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        <span>Enterprise</span>
        <select
          name="enterpriseId"
          required
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select enterprise</option>
          {enterprises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.companyName}
            </option>
          ))}
        </select>
        {fieldErrors.enterpriseId ? (
          <span className="text-xs text-destructive">
            {fieldErrors.enterpriseId.join(", ")}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Amount</span>
        <Input name="amount" type="number" step="0.01" min="0.01" required />
        {fieldErrors.amount ? (
          <span className="text-xs text-destructive">
            {fieldErrors.amount.join(", ")}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Currency</span>
        <select
          name="currency"
          defaultValue="MUR"
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Payment method</span>
        <select
          name="paymentMethod"
          defaultValue="WIRE"
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Reference</span>
        <Input name="reference" placeholder="Internal ref or PO number" />
      </label>

      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        <span>Notes</span>
        <textarea
          name="notes"
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      {error ? (
        <div className="md:col-span-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
