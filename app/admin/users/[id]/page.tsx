// User detail page — profile (Candidate or Enterprise), audit log, linked rows.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("app.admin");

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
        description={t("userDetail.pageDescription", { userId: user.id, clerkId: user.clerkId })}
      >
        <Link
          href="/admin/users"
          className="mg-body-sm text-primary hover:underline"
        >
          {t("userDetail.backToUsers")}
        </Link>
      </PageHeader>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("userDetail.account.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 mg-body-sm">
            <div>
              <span className="text-muted-foreground">{t("userDetail.account.role")}</span>{" "}
              <span className="font-mono">{user.role}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("userDetail.account.language")}</span>{" "}
              {user.lang}
            </div>
            <div>
              <span className="text-muted-foreground">{t("userDetail.account.created")}</span>{" "}
              {user.createdAt.toISOString()}
            </div>
            <div>
              <span className="text-muted-foreground">{t("userDetail.account.updated")}</span>{" "}
              {user.updatedAt.toISOString()}
            </div>
          </CardContent>
        </Card>

        {user.candidate ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("userDetail.candidate.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 mg-body-sm">
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.name")}</span>{" "}
                {user.candidate.firstName} {user.candidate.lastName}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.city")}</span>{" "}
                {user.candidate.city ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.phone")}</span>{" "}
                {user.candidate.phone ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.profileScore")}</span>{" "}
                {user.candidate.profileScore}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.skills")}</span>{" "}
                {user.candidate.skills.join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.candidate.sectors")}</span>{" "}
                {user.candidate.sectors.join(", ") || "—"}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {user.enterprise ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("userDetail.enterprise.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 mg-body-sm">
              <div>
                <span className="text-muted-foreground">{t("userDetail.enterprise.company")}</span>{" "}
                {user.enterprise.companyName}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.enterprise.sector")}</span>{" "}
                {user.enterprise.sector ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.enterprise.verified")}</span>{" "}
                {user.enterprise.verified ? t("userDetail.enterprise.verifiedYes") : t("userDetail.enterprise.verifiedNo")}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.enterprise.plan")}</span>{" "}
                {user.enterprise.plan}
              </div>
              <div>
                <span className="text-muted-foreground">{t("userDetail.enterprise.contact")}</span>{" "}
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
            <CardTitle>{t("userDetail.auditLog.title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full mg-body-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">{t("userDetail.auditLog.colWhen")}</th>
                  <th className="p-3">{t("userDetail.auditLog.colAction")}</th>
                  <th className="p-3">{t("userDetail.auditLog.colResource")}</th>
                  <th className="p-3">{t("userDetail.auditLog.colIp")}</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      {t("userDetail.auditLog.empty")}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      <td className="p-3 whitespace-nowrap">
                        {a.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="p-3 font-mono mg-caption">{a.action}</td>
                      <td className="p-3 font-mono mg-caption">
                        {a.resourceType}
                        {a.resourceId ? `/${a.resourceId}` : ""}
                      </td>
                      <td className="p-3 font-mono mg-caption">
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
