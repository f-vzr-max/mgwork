import { getTranslations } from "next-intl/server";
import { PageHeader, Card } from "@/components/mg";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPendingDeletionsPage() {
  const t = await getTranslations("app.admin");

  const rows = await prisma.auditLog.findMany({
    where: { action: "user.deletion_request" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <>
      <PageHeader
        title={t("pendingDeletions.title")}
        subtitle={t("pendingDeletions.subtitle")}
      />

      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px minmax(0, 1fr) minmax(0, 1fr)",
              padding: "10px 20px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            className="mg-micro"
          >
            <span>{t("pendingDeletions.colWhen")}</span>
            <span>{t("pendingDeletions.colUser")}</span>
            <span>{t("pendingDeletions.colUserId")}</span>
          </div>

          {rows.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "hsl(var(--muted-foreground))",
                fontSize: 14,
              }}
            >
              {t("pendingDeletions.empty")}
            </div>
          ) : (
            rows.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px minmax(0, 1fr) minmax(0, 1fr)",
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                  gap: 8,
                }}
              >
                <span className="mg-mono mg-caption" style={{ whiteSpace: "nowrap" }}>
                  {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </span>
                <span
                  className="mg-caption"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.user.email}
                </span>
                <span
                  className="mg-mono mg-caption"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.userId}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
