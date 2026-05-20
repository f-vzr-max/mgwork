// Staff overview — quick health snapshot for the operations team.
// Server component that pulls a handful of counts so the team can see what's
// in the queue before drilling into the dedicated views.

import { PageHeader, KpiCard, Card, Stack, StatusBadge } from "@/components/mg";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadKpis() {
  const [pending, deployed, alerts, interventions] = await Promise.all([
    prisma.document.count({ where: { status: "PENDING" } }),
    prisma.application.count({ where: { status: "DEPLOYED" } }),
    prisma.checkpoint.count({ where: { status: "ALERT" } }),
    prisma.checkpoint.count({ where: { status: "INTERVENTION_REQUIRED" } }),
  ]);
  return { pending, deployed, alerts, interventions };
}

export default async function StaffDashboard() {
  const k = await loadKpis();

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Vérification documentaire et suivi post-déploiement."
      />
      <div
        style={{
          padding: "0 32px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard
          label="Documents en file"
          value={k.pending.toString()}
          unit="à vérifier"
          tone={k.pending > 0 ? "primary" : "success"}
        />
        <KpiCard
          label="Candidats déployés"
          value={k.deployed.toString()}
          unit="actifs"
          tone="success"
        />
        <KpiCard
          label="Alertes ouvertes"
          value={k.alerts.toString()}
          tone={k.alerts > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Interventions requises"
          value={k.interventions.toString()}
          tone={k.interventions > 0 ? "danger" : "success"}
        />
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={20}>
          <Stack dir="column" gap={12}>
            <h3 className="mg-h4" style={{ margin: 0 }}>
              Actions du jour
            </h3>
            <Stack dir="row" gap={8} wrap>
              <StatusBadge status="PENDING" label={`${k.pending} en attente`} />
              {k.alerts > 0 && (
                <StatusBadge status="ALERT" label={`${k.alerts} alertes`} />
              )}
              {k.interventions > 0 && (
                <StatusBadge
                  status="INTERVENTION_REQUIRED"
                  label={`${k.interventions} interventions`}
                />
              )}
              {k.alerts === 0 && k.interventions === 0 && k.pending === 0 && (
                <StatusBadge status="OK" label="Tout est à jour" />
              )}
            </Stack>
            <p
              className="mg-body-sm"
              style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}
            >
              Utilisez la file documents pour traiter les pièces en attente, ou
              suivez les candidats déployés depuis l&apos;onglet « Suivi candidats ».
            </p>
          </Stack>
        </Card>
      </div>
    </>
  );
}
