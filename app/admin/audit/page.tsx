// Admin audit log viewer — paginated; filters by userId / action /
// resourceType / date range. Read-only.

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <PageHeader title="Audit log" description="Compliance trail for sensitive actions." />

      <div className="px-6 pt-4">
        <form method="get" className="grid gap-3 md:grid-cols-6 md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span>User id</span>
            <Input name="userId" defaultValue={filters.userId ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Action contains</span>
            <Input name="action" defaultValue={filters.action ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Resource</span>
            <Input
              name="resourceType"
              defaultValue={filters.resourceType ?? ""}
              placeholder="user, invoice, document..."
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>From</span>
            <Input
              type="date"
              name="from"
              defaultValue={filters.from ? filters.from.toISOString().slice(0, 10) : ""}
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
                  <th className="p-3">When</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {page.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No audit entries match these filters.
                    </td>
                  </tr>
                ) : (
                  page.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0 align-top">
                      <td className="p-3 whitespace-nowrap font-mono text-xs">
                        {a.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="p-3">
                        <Link href={`/admin/users/${a.userId}`} className="text-primary hover:underline">
                          {a.user.email}
                        </Link>
                        <div className="text-xs text-muted-foreground">{a.user.role}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{a.action}</td>
                      <td className="p-3 font-mono text-xs">
                        {a.resourceType}
                        {a.resourceId ? `/${a.resourceId}` : ""}
                      </td>
                      <td className="p-3 font-mono text-xs">{a.ipAddress ?? "—"}</td>
                      <td className="p-3 max-w-xs">
                        <pre className="whitespace-pre-wrap break-words text-xs">
                          {a.metadata ? JSON.stringify(a.metadata) : "—"}
                        </pre>
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
