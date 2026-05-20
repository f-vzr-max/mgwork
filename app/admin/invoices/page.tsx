// Admin invoices list — paginated, status + date filters. Business logic
// preserved; chrome restyled with MG design system primitives.

import Link from "next/link";
import { PageHeader, Card, Button, Input, Stack, StatusBadge } from "@/components/mg";
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

  const selectStyle: React.CSSProperties = {
    height: 40,
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--background))",
    padding: "0 12px",
    fontSize: 14,
    color: "hsl(var(--foreground))",
  };

  return (
    <>
      <PageHeader
        title="Factures"
        subtitle="Factures émises et statut de paiement."
        action={
          <Link href="/admin/invoices/new" style={{ textDecoration: "none" }}>
            <Button iconLeft="plus">Nouvelle facture</Button>
          </Link>
        }
      />

      <div style={{ padding: "0 32px 16px" }}>
        <Card padding={20}>
          <form
            method="get"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Statut</span>
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                style={selectStyle}
              >
                <option value="">Tous</option>
                <option value="PENDING">En attente</option>
                <option value="PAID">Payée</option>
                <option value="OVERDUE">En retard</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">ID entreprise</span>
              <Input
                name="enterpriseId"
                defaultValue={filters.enterpriseId ?? ""}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Du</span>
              <Input
                type="date"
                name="from"
                defaultValue={
                  filters.from ? filters.from.toISOString().slice(0, 10) : ""
                }
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Au</span>
              <Input
                type="date"
                name="to"
                defaultValue={filters.to ? filters.to.toISOString().slice(0, 10) : ""}
              />
            </label>
            <Button type="submit" iconLeft="filter">
              Filtrer
            </Button>
          </form>
        </Card>
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px minmax(0, 1fr) 140px 120px 140px 160px",
              padding: "10px 20px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            className="mg-micro"
          >
            <span>Émise</span>
            <span>Entreprise</span>
            <span>Montant</span>
            <span>Méthode</span>
            <span>Statut</span>
            <span>Référence</span>
          </div>
          {page.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "hsl(var(--muted-foreground))",
                fontSize: 14,
              }}
            >
              Aucune facture ne correspond à ces filtres.
            </div>
          ) : (
            page.map((inv, i) => (
              <div
                key={inv.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "120px minmax(0, 1fr) 140px 120px 140px 160px",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                }}
              >
                <span
                  className="mg-tabular mg-body-sm"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {inv.issuedAt.toISOString().slice(0, 10)}
                </span>
                <span
                  className="mg-body-sm"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {inv.enterprise.companyName}
                </span>
                <span className="mg-tabular mg-body-sm">
                  {inv.amount.toFixed(2)} {inv.currency}
                </span>
                <span className="mg-mono" style={{ fontSize: 11 }}>
                  {inv.paymentMethod}
                </span>
                <StatusBadge status={inv.status} />
                <Link
                  href={`/admin/invoices/${inv.id}`}
                  className="mg-mono"
                  style={{
                    color: "hsl(var(--primary))",
                    textDecoration: "none",
                    fontSize: 12,
                  }}
                >
                  {inv.reference ?? inv.id.slice(0, 8)}
                </Link>
              </div>
            ))
          )}
        </Card>

        <Stack
          dir="row"
          justify="flex-end"
          gap={12}
          style={{ marginTop: 16, fontSize: 13 }}
        >
          {filters.cursor ? (
            <Link
              href={buildHref({ cursor: undefined })}
              style={{ color: "hsl(var(--primary))", textDecoration: "none" }}
            >
              Première page
            </Link>
          ) : null}
          {nextCursor ? (
            <Link
              href={buildHref({ cursor: nextCursor })}
              style={{ color: "hsl(var(--primary))", textDecoration: "none" }}
            >
              Suivante →
            </Link>
          ) : null}
        </Stack>
      </div>
    </>
  );
}
