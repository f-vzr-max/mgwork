// Admin overview dashboard — real KPIs computed via Prisma. Server component.
// Data-fetching logic is preserved verbatim; only the JSX has been restyled
// to use the MG design system primitives.

import { PageHeader, KpiCard, Stack } from "@/components/mg";
import { prisma } from "@/lib/prisma";

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
  const k = await loadKpis();

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Santé de la plateforme, inscriptions et conformité"
      />
      <div
        style={{
          padding: "0 32px 32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard
          label="Candidats"
          value={k.candidates.toString()}
          unit="profils"
          tone="primary"
        />
        <KpiCard
          label="Entreprises"
          value={k.enterprises.toString()}
          unit="comptes"
          tone="primary"
        />
        <KpiCard
          label="Offres actives"
          value={k.activeOffers.toString()}
          unit="publiées"
          tone="success"
        />
        <KpiCard
          label="Interventions ouvertes"
          value={k.openInterventions.toString()}
          unit="à traiter"
          tone={k.openInterventions > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Revenu (payé)"
          value={formatRevenue(k.revenue)}
          tone="success"
        />
      </div>
      <div style={{ padding: "0 32px 32px" }}>
        <Stack dir="column" gap={8}>
          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            Les indicateurs sont rafraîchis à chaque chargement.
          </span>
        </Stack>
      </div>
    </>
  );
}
