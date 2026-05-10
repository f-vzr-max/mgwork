// Admin overview dashboard — real KPIs computed via Prisma. Server component.

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getLocale, tFor } from "@/lib/i18n";

async function loadKpis() {
  const [candidates, enterprises, activeOffers, openInterventions, paidAgg] =
    await Promise.all([
      prisma.candidate.count(),
      prisma.enterprise.count(),
      prisma.jobOffer.count({ where: { status: "ACTIVE" } }),
      prisma.checkpoint.count({ where: { status: "INTERVENTION_REQUIRED" } }),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

  return {
    candidates,
    enterprises,
    activeOffers,
    openInterventions,
    revenue: Number(paidAgg._sum.amount ?? 0),
  };
}

function formatRevenue(amount: number, locale: string): string {
  // Display in MUR — currency-agnostic since invoices may use multiple currencies,
  // but PAID aggregate is shown as a single sum here for skeleton purposes.
  try {
    return new Intl.NumberFormat(locale, {
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
  const lang = await getLocale();
  const t = tFor(lang);
  const intlLocale = lang === "FR" ? "fr-FR" : lang === "MG" ? "mg-MG" : "en-US";
  const k = await loadKpis();

  return (
    <>
      <PageHeader
        title={t("admin.overview.title", "Admin overview")}
        description={t(
          "admin.overview.description",
          "Platform-wide health, signups, and compliance posture.",
        )}
      />
      <div className="grid gap-4 p-6 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.kpi.candidates", "Candidates")}</CardTitle>
            <CardDescription>
              {k.candidates} {t("admin.kpi.total", "total")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.candidates === 0
              ? t("admin.kpi.noCandidates", "No candidates yet.")
              : t("admin.kpi.live", "Profiles in the system.")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.kpi.enterprises", "Enterprises")}</CardTitle>
            <CardDescription>
              {k.enterprises} {t("admin.kpi.total", "total")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.enterprises === 0
              ? t("admin.kpi.noEnterprises", "No enterprises yet.")
              : t("admin.kpi.companiesOnboarded", "Companies onboarded.")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.kpi.activeOffers", "Active offers")}</CardTitle>
            <CardDescription>
              {k.activeOffers} {t("admin.kpi.published", "published")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.activeOffers === 0
              ? t("admin.kpi.noOffers", "No offers yet.")
              : t("admin.kpi.acceptingApplications", "Accepting applications.")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("admin.kpi.openInterventions", "Open interventions")}
            </CardTitle>
            <CardDescription>
              {k.openInterventions}{" "}
              {t("admin.kpi.needAttention", "need attention")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.openInterventions === 0
              ? t("admin.kpi.allClear", "All clear.")
              : t("admin.kpi.staffShouldFollow", "Staff to follow up.")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.kpi.revenue", "Revenue (paid)")}</CardTitle>
            <CardDescription>{formatRevenue(k.revenue, intlLocale)}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.revenue === 0
              ? t("admin.kpi.noRevenue", "No paid invoices yet.")
              : t("admin.kpi.cumulativeRevenue", "Cumulative paid total.")}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
