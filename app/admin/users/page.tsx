// Admin user list — paginated, with role/lang/verified filters and
// a per-row actions menu (ban toggle / change role / impersonate / detail).
//
// Server-renders the filtered query; the actions row is a client component so
// that POST calls + Clerk impersonation URL can be triggered from the browser.

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  // Strip undefineds before parse.
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
    ...(filters.cursor
      ? { cursor: { id: filters.cursor }, skip: 1 }
      : {}),
    include: {
      enterprise: { select: { verified: true, companyName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  });

  // Apply verified filter post-query (only meaningful for ENTERPRISE rows).
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

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage roles, ban accounts, impersonate for support."
      />

      <div className="px-6 pt-4">
        <form
          method="get"
          className="grid gap-3 md:grid-cols-5 md:items-end"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span>Email contains</span>
            <Input name="q" defaultValue={filters.q ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Role</span>
            <select
              name="role"
              defaultValue={filters.role ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Language</span>
            <select
              name="lang"
              defaultValue={filters.lang ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="FR">FR</option>
              <option value="EN">EN</option>
              <option value="MG">MG</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Verified (enterprises)</span>
            <select
              name="verified"
              defaultValue={filters.verified ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </label>
          <Button type="submit" className="md:self-end">
            Filter
          </Button>
        </form>
      </div>

      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Lang</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No users match these filters.
                    </td>
                  </tr>
                ) : (
                  page.map((u) => {
                    const display =
                      u.candidate
                        ? `${u.candidate.firstName} ${u.candidate.lastName}`
                        : u.enterprise?.companyName ?? "—";
                    return (
                      <tr key={u.id} className="border-b last:border-b-0">
                        <td className="p-3">
                          <Link
                            className="text-primary hover:underline"
                            href={`/admin/users/${u.id}`}
                          >
                            {u.email}
                          </Link>
                        </td>
                        <td className="p-3">{display}</td>
                        <td className="p-3 font-mono text-xs">{u.role}</td>
                        <td className="p-3">{u.lang}</td>
                        <td className="p-3 whitespace-nowrap">
                          {u.createdAt.toISOString().slice(0, 10)}
                        </td>
                        <td className="p-3 text-right">
                          <UserActionsMenu
                            userId={u.id}
                            email={u.email}
                            role={u.role}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {filters.cursor ? (
            <Link
              href={buildHref({ cursor: undefined })}
              className="text-primary hover:underline"
            >
              First page
            </Link>
          ) : null}
          {nextCursor ? (
            <Link
              href={buildHref({ cursor: nextCursor })}
              className="text-primary hover:underline"
            >
              Next →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
