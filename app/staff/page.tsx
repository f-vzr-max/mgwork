// Staff overview — quick health snapshot for the operations team.
// Server component that pulls a handful of counts so the team can see what's
// in the queue before drilling into the dedicated views.

import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("app.staff.dashboard");
  const k = await loadKpis();

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
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
          label={t("kpi.documentsQueue.label")}
          value={k.pending.toString()}
          unit={t("kpi.documentsQueue.unit")}
          tone={k.pending > 0 ? "primary" : "success"}
        />
        <KpiCard
          label={t("kpi.deployedCandidates.label")}
          value={k.deployed.toString()}
          unit={t("kpi.deployedCandidates.unit")}
          tone="success"
        />
        <KpiCard
          label={t("kpi.openAlerts.label")}
          value={k.alerts.toString()}
          tone={k.alerts > 0 ? "danger" : "success"}
        />
        <KpiCard
          label={t("kpi.interventionsRequired.label")}
          value={k.interventions.toString()}
          tone={k.interventions > 0 ? "danger" : "success"}
        />
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={20}>
          <Stack dir="column" gap={12}>
            <h3 className="mg-h4" style={{ margin: 0 }}>
              {t("actions.sectionTitle")}
            </h3>
            <Stack dir="row" gap={8} wrap>
              <StatusBadge status="PENDING" label={t("actions.badge.pending", { n: k.pending })} />
              {k.alerts > 0 && (
                <StatusBadge status="ALERT" label={t("actions.badge.alerts", { n: k.alerts })} />
              )}
              {k.interventions > 0 && (
                <StatusBadge
                  status="INTERVENTION_REQUIRED"
                  label={t("actions.badge.interventions", { n: k.interventions })}
                />
              )}
              {k.alerts === 0 && k.interventions === 0 && k.pending === 0 && (
                <StatusBadge status="OK" label={t("actions.badge.allClear")} />
              )}
            </Stack>
            <p
              className="mg-body-sm"
              style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}
            >
              {t("actions.helperText")}
            </p>
          </Stack>
        </Card>
      </div>
    </>
  );
}
