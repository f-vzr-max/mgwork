// Admin audit log viewer — paginated, filterable by userId / action /
// resourceType / date range. Business logic preserved; chrome restyled with
// MG design system primitives.

import Link from "next/link";
import { PageHeader, Card, Button, Input, Stack } from "@/components/mg";
import { prisma } from "@/lib/prisma";
import { auditQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries({
    userId: pickFirst(searchParams.userId),
    action: pickFirst(searchParams.action),
    resourceType: pickFirst(searchParams.resourceType),
    from: pickFirst(searchParams.from),
    to: pickFirst(searchParams.to),
    cursor: pickFirst(searchParams.cursor),
    limit: pickFirst(searchParams.limit),
  })) {
    if (typeof v === "string" && v.length > 0) cleaned[k] = v;
  }
  const parsed = auditQuerySchema.safeParse(cleaned);
  const filters = parsed.success ? parsed.data : {};
  const limit = filters.limit ?? 50;

  const where = {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: { contains: filters.action } } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { user: { select: { email: true, role: true } } },
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
    return q ? `/admin/audit?${q}` : "/admin/audit";
  }

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        subtitle="Piste de conformité pour les actions sensibles."
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
              <span className="mg-caption">ID utilisateur</span>
              <Input name="userId" defaultValue={filters.userId ?? ""} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Action contient</span>
              <Input name="action" defaultValue={filters.action ?? ""} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Ressource</span>
              <Input
                name="resourceType"
                defaultValue={filters.resourceType ?? ""}
                placeholder="user, invoice, document..."
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
              gridTemplateColumns: "180px minmax(0, 1fr) 160px 200px 140px minmax(0, 1.4fr)",
              padding: "10px 20px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            className="mg-micro"
          >
            <span>Quand</span>
            <span>Acteur</span>
            <span>Action</span>
            <span>Ressource</span>
            <span>IP</span>
            <span>Métadonnées</span>
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
              Aucune entrée ne correspond à ces filtres.
            </div>
          ) : (
            page.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "180px minmax(0, 1fr) 160px 200px 140px minmax(0, 1.4fr)",
                  padding: "12px 20px",
                  alignItems: "flex-start",
                  borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                  gap: 8,
                }}
              >
                <span className="mg-mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {a.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/admin/users/${a.userId}`}
                    style={{
                      color: "hsl(var(--primary))",
                      textDecoration: "none",
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {a.user.email}
                  </Link>
                  <div
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {a.user.role}
                  </div>
                </div>
                <span className="mg-mono" style={{ fontSize: 11 }}>
                  {a.action}
                </span>
                <span
                  className="mg-mono"
                  style={{
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.resourceType}
                  {a.resourceId ? `/${a.resourceId}` : ""}
                </span>
                <span className="mg-mono" style={{ fontSize: 11 }}>
                  {a.ipAddress ?? "—"}
                </span>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {a.metadata ? JSON.stringify(a.metadata) : "—"}
                </pre>
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
