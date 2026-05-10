// User detail page — profile (Candidate or Enterprise), audit log, linked rows.

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      candidate: true,
      enterprise: true,
    },
  });

  if (!user) return notFound();

  // Audit logs WHERE this user was the actor (their own actions).
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title={user.email}
        description={`Internal id ${user.id} — Clerk id ${user.clerkId}`}
      >
        <Link
          href="/admin/users"
          className="text-sm text-primary hover:underline"
        >
          ← Back to users
        </Link>
      </PageHeader>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Role:</span>{" "}
              <span className="font-mono">{user.role}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Language:</span>{" "}
              {user.lang}
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              {user.createdAt.toISOString()}
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              {user.updatedAt.toISOString()}
            </div>
          </CardContent>
        </Card>

        {user.candidate ? (
          <Card>
            <CardHeader>
              <CardTitle>Candidate profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                {user.candidate.firstName} {user.candidate.lastName}
              </div>
              <div>
                <span className="text-muted-foreground">City:</span>{" "}
                {user.candidate.city ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>{" "}
                {user.candidate.phone ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Profile score:</span>{" "}
                {user.candidate.profileScore}
              </div>
              <div>
                <span className="text-muted-foreground">Skills:</span>{" "}
                {user.candidate.skills.join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Sectors:</span>{" "}
                {user.candidate.sectors.join(", ") || "—"}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {user.enterprise ? (
          <Card>
            <CardHeader>
              <CardTitle>Enterprise profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Company:</span>{" "}
                {user.enterprise.companyName}
              </div>
              <div>
                <span className="text-muted-foreground">Sector:</span>{" "}
                {user.enterprise.sector ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Verified:</span>{" "}
                {user.enterprise.verified ? "Yes" : "No"}
              </div>
              <div>
                <span className="text-muted-foreground">Plan:</span>{" "}
                {user.enterprise.plan}
              </div>
              <div>
                <span className="text-muted-foreground">Contact:</span>{" "}
                {user.enterprise.contactName ?? "—"}{" "}
                {user.enterprise.contactPhone ? `(${user.enterprise.contactPhone})` : ""}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Audit log (own actions, last 50)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No actions recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      <td className="p-3 whitespace-nowrap">
                        {a.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="p-3 font-mono text-xs">{a.action}</td>
                      <td className="p-3 font-mono text-xs">
                        {a.resourceType}
                        {a.resourceId ? `/${a.resourceId}` : ""}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {a.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
