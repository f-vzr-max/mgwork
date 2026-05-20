// Admin user list — paginated, with role/lang/verified filters and a per-row
// actions menu. Business logic preserved verbatim; chrome restyled with MG
// design system primitives.

import Link from "next/link";
import { PageHeader, Card, Button, Input, Stack } from "@/components/mg";
import { prisma } from "@/lib/prisma";
import { adminUserListQuerySchema } from "@/lib/validation/admin";
import { ROLES } from "@/lib/roles";
import { UserActionsMenu } from "@/components/admin/UserActionsMenu";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = {
    role: pickFirst(searchParams.role),
    lang: pickFirst(searchParams.lang),
    verified: pickFirst(searchParams.verified),
    q: pickFirst(searchParams.q),
    cursor: pickFirst(searchParams.cursor),
    limit: pickFirst(searchParams.limit),
  };
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.length > 0) cleaned[k] = v;
  }
  const parsed = adminUserListQuerySchema.safeParse(cleaned);
  const filters = parsed.success ? parsed.data : {};

  const limit = filters.limit ?? 25;
  const where = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.lang ? { lang: filters.lang } : {}),
    ...(filters.q
      ? { email: { contains: filters.q, mode: "insensitive" as const } }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: {
      enterprise: { select: { verified: true, companyName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  });

  const filtered =
    filters.verified !== undefined
      ? users.filter((u) =>
          filters.verified === "true"
            ? u.enterprise?.verified === true
            : u.enterprise?.verified !== true,
        )
      : users;

  const hasMore = filtered.length > limit;
  const page = filtered.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = { ...filters, ...overrides } as Record<string, unknown>;
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
    const q = params.toString();
    return q ? `/admin/users?${q}` : "/admin/users";
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
        title="Utilisateurs"
        subtitle="Gérer les rôles, bannir des comptes, dépanner par impersonation."
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
              <span className="mg-caption">L&apos;email contient</span>
              <Input name="q" defaultValue={filters.q ?? ""} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Rôle</span>
              <select name="role" defaultValue={filters.role ?? ""} style={selectStyle}>
                <option value="">Tous</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Langue</span>
              <select name="lang" defaultValue={filters.lang ?? ""} style={selectStyle}>
                <option value="">Toutes</option>
                <option value="FR">FR</option>
                <option value="EN">EN</option>
                <option value="MG">MG</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mg-caption">Vérifié (entreprises)</span>
              <select
                name="verified"
                defaultValue={filters.verified ?? ""}
                style={selectStyle}
              >
                <option value="">Tous</option>
                <option value="true">Vérifié</option>
                <option value="false">Non vérifié</option>
              </select>
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
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 120px 80px 130px 140px",
              padding: "10px 20px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            className="mg-micro"
          >
            <span>Email</span>
            <span>Nom</span>
            <span>Rôle</span>
            <span>Langue</span>
            <span>Créé</span>
            <span style={{ textAlign: "right" }}>Actions</span>
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
              Aucun utilisateur ne correspond à ces filtres.
            </div>
          ) : (
            page.map((u, i) => {
              const display = u.candidate
                ? `${u.candidate.firstName} ${u.candidate.lastName}`
                : u.enterprise?.companyName ?? "—";
              return (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1.4fr) minmax(0, 1fr) 120px 80px 130px 140px",
                    padding: "14px 20px",
                    alignItems: "center",
                    borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                  }}
                >
                  <Link
                    href={`/admin/users/${u.id}`}
                    style={{
                      color: "hsl(var(--primary))",
                      textDecoration: "none",
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.email}
                  </Link>
                  <span
                    className="mg-body-sm"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {display}
                  </span>
                  <span className="mg-mono" style={{ fontSize: 11 }}>
                    {u.role}
                  </span>
                  <span className="mg-body-sm">{u.lang}</span>
                  <span
                    className="mg-tabular mg-body-sm"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {u.createdAt.toISOString().slice(0, 10)}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <UserActionsMenu userId={u.id} email={u.email} role={u.role} />
                  </div>
                </div>
              );
            })
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
