// Admin invoices list — paginated, with status + date-range filters.

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { invoiceListQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries({
    status: pickFirst(searchParams.status),
    enterpriseId: pickFirst(searchParams.enterpriseId),
    from: pickFirst(searchParams.from),
    to: pickFirst(searchParams.to),
    cursor: pickFirst(searchParams.cursor),
    limit: pickFirst(searchParams.limit),
  })) {
    if (typeof v === "string" && v.length > 0) cleaned[k] = v;
  }
  const parsed = invoiceListQuerySchema.safeParse(cleaned);
  const filters = parsed.success ? parsed.data : {};
  const limit = filters.limit ?? 25;

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.enterpriseId ? { enterpriseId: filters.enterpriseId } : {}),
    ...(filters.from || filters.to
      ? {
          issuedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { enterprise: { select: { companyName: true } } },
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = { ...filters, ...overrides } as Record<string, unknown>;
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
    }
    const q = params.toString();
    return q ? `/admin/invoices?${q}` : "/admin/invoices";
  }

  return (
    <>
      <PageHeader title="Invoices" description="Issued invoices and payment status.">
        <Link href="/admin/invoices/new">
          <Button>New invoice</Button>
        </Link>
      </PageHeader>

      <div className="px-6 pt-4">
        <form method="get" className="grid gap-3 md:grid-cols-5 md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span>Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Enterprise id</span>
            <Input name="enterpriseId" defaultValue={filters.enterpriseId ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>From</span>
            <Input
              type="date"
              name="from"
              defaultValue={
                filters.from ? filters.from.toISOString().slice(0, 10) : ""
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>To</span>
            <Input
              type="date"
              name="to"
              defaultValue={filters.to ? filters.to.toISOString().slice(0, 10) : ""}
            />
          </label>
          <Button type="submit">Filter</Button>
        </form>
      </div>

      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Issued</th>
                  <th className="p-3">Enterprise</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {page.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No invoices match these filters.
                    </td>
                  </tr>
                ) : (
                  page.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="p-3 whitespace-nowrap">
                        {inv.issuedAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="p-3">{inv.enterprise.companyName}</td>
                      <td className="p-3 whitespace-nowrap">
                        {inv.amount.toFixed(2)} {inv.currency}
                      </td>
                      <td className="p-3 text-xs">{inv.paymentMethod}</td>
                      <td className="p-3">
                        <span className="font-mono text-xs">{inv.status}</span>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="text-primary hover:underline"
                        >
                          {inv.reference ?? inv.id.slice(0, 8)}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {filters.cursor ? (
            <Link href={buildHref({ cursor: undefined })} className="text-primary hover:underline">
              First page
            </Link>
          ) : null}
          {nextCursor ? (
            <Link href={buildHref({ cursor: nextCursor })} className="text-primary hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
