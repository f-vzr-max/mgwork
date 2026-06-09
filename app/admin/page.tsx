// Admin overview dashboard — real KPIs computed via Prisma. Server component.
// Data-fetching logic is preserved verbatim; only the JSX has been restyled
// to use the MG design system primitives.

import { getTranslations } from "next-intl/server";
import { PageHeader, KpiCard, Stack } from "@/components/mg";
import { prisma } from "@/lib/prisma";

async function loadKpis() {
  const [
    candidates,
    enterprises,
    activeOffers,
    openInterventions,
    paidAgg,
    usersByRole,
    totalApplications,
    pendingDocuments,
  ] = await Promise.all([
    prisma.candidate.count(),
    prisma.enterprise.count(),
    prisma.jobOffer.count({ where: { status: "ACTIVE" } }),
    prisma.checkpoint.count({ where: { status: "INTERVENTION_REQUIRED" } }),
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.application.count(),
    prisma.document.count({ where: { status: "PENDING" } }),
  ]);

  const roleCounts: Record<string, number> = {};
  let totalUsers = 0;
  for (const row of usersByRole) {
    roleCounts[row.role] = row._count._all;
    totalUsers += row._count._all;
  }
  const staffUsers =
    (roleCounts.STAFF_FOLLOWUP ?? 0) + (roleCounts.STAFF_DOCUMENTS ?? 0);
  const adminUsers =
    (roleCounts.SUPER_ADMIN ?? 0) + (roleCounts.ADMIN ?? 0);

  return {
    candidates,
    enterprises,
    activeOffers,
    openInterventions,
    revenue: Number(paidAgg._sum.amount ?? 0),
    totalUsers,
    staffUsers,
    adminUsers,
    totalApplications,
    pendingDocuments,
  };
}

function formatRevenue(amount: number): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MUR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} MUR`;
  }
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const t = await getTranslations("app.admin.dashboard");
  const k = await loadKpis();

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />
      <div style={{ padding: "0 32px 32px" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={t("kpi.totalUsers.label")}
            value={k.totalUsers.toString()}
            unit={t("kpi.totalUsers.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.candidates.label")}
            value={k.candidates.toString()}
            unit={t("kpi.candidates.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.enterprises.label")}
            value={k.enterprises.toString()}
            unit={t("kpi.enterprises.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.staffUsers.label")}
            value={k.staffUsers.toString()}
            unit={t("kpi.staffUsers.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.adminUsers.label")}
            value={k.adminUsers.toString()}
            unit={t("kpi.adminUsers.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.activeOffers.label")}
            value={k.activeOffers.toString()}
            unit={t("kpi.activeOffers.unit")}
            tone="success"
          />
          <KpiCard
            label={t("kpi.totalApplications.label")}
            value={k.totalApplications.toString()}
            unit={t("kpi.totalApplications.unit")}
            tone="primary"
          />
          <KpiCard
            label={t("kpi.pendingDocuments.label")}
            value={k.pendingDocuments.toString()}
            unit={t("kpi.pendingDocuments.unit")}
            tone={k.pendingDocuments > 0 ? "danger" : "success"}
          />
          <KpiCard
            label={t("kpi.openInterventions.label")}
            value={k.openInterventions.toString()}
            unit={t("kpi.openInterventions.unit")}
            tone={k.openInterventions > 0 ? "danger" : "success"}
          />
          <KpiCard
            label={t("kpi.revenue.label")}
            value={formatRevenue(k.revenue)}
            tone="success"
          />
        </div>
      </div>
      <div style={{ padding: "0 32px 32px" }}>
        <Stack dir="column" gap={8}>
          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("dashboard.refreshCaption")}
          </span>
        </Stack>
      </div>
    </>
  );
}
