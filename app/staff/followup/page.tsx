// Staff follow-up — lists DEPLOYED applications grouped by enterprise. Each
// row surfaces the candidate, the latest CheckpointStatus and days since the
// last checkpoint. Business logic preserved verbatim; chrome restyled with
// the MG design system.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import {
  PageHeader,
  Card,
  Stack,
  Avatar,
  StatusBadge,
  KpiCard,
} from "@/components/mg";
import type { StatusKey } from "@/components/mg";

export const dynamic = "force-dynamic";

type DeployedRow = {
  applicationId: string;
  enterpriseId: string;
  enterpriseName: string;
  candidateLabel: string;
  latestStatus: StatusKey | null;
  daysSinceLatest: number | null;
};

async function loadDeployed(): Promise<DeployedRow[]> {
  const apps = await prisma.application.findMany({
    where: { status: "DEPLOYED" },
    select: {
      id: true,
      candidate: { select: { firstName: true, lastName: true } },
      jobOffer: {
        select: {
          enterprise: { select: { id: true, companyName: true } },
        },
      },
      checkpoints: {
        orderBy: { date: "desc" },
        take: 1,
        select: { status: true, date: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = Date.now();
  return apps.map((a) => {
    const latest = a.checkpoints[0];
    const daysSinceLatest =
      latest != null
        ? Math.floor((now - latest.date.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    return {
      applicationId: a.id,
      enterpriseId: a.jobOffer.enterprise.id,
      enterpriseName: a.jobOffer.enterprise.companyName,
      candidateLabel: `${a.candidate.firstName} ${a.candidate.lastName}`,
      latestStatus: (latest?.status ?? null) as StatusKey | null,
      daysSinceLatest,
    };
  });
}

function groupByEnterprise(rows: DeployedRow[]): Map<string, { name: string; rows: DeployedRow[] }> {
  const groups = new Map<string, { name: string; rows: DeployedRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.enterpriseId);
    if (g) {
      g.rows.push(r);
    } else {
      groups.set(r.enterpriseId, { name: r.enterpriseName, rows: [r] });
    }
  }
  return groups;
}

function staleTone(days: number | null): "muted" | "warning" | "danger" {
  if (days === null) return "warning";
  if (days >= 45) return "danger";
  if (days >= 30) return "warning";
  return "muted";
}

export default async function StaffFollowupPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) redirect("/sign-in");
  if (!canAccess(user.role as Role, "staff")) redirect("/");

  const rows = await loadDeployed();
  const groups = groupByEnterprise(rows);
  const totalAlerts = rows.filter(
    (r) => r.latestStatus === "ALERT" || r.latestStatus === "INTERVENTION_REQUIRED",
  ).length;
  const stale30 = rows.filter(
    (r) => r.daysSinceLatest !== null && r.daysSinceLatest >= 30,
  ).length;

  return (
    <>
      <PageHeader
        title="Suivi candidats"
        subtitle={`${rows.length} candidat${rows.length === 1 ? "" : "s"} déployé${rows.length === 1 ? "" : "s"} · ${totalAlerts} à surveiller`}
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
          label="Déployés actifs"
          value={rows.length.toString()}
          tone="success"
        />
        <KpiCard
          label="À surveiller"
          value={totalAlerts.toString()}
          tone={totalAlerts > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Sans checkpoint > 30j"
          value={stale30.toString()}
          tone={stale30 > 0 ? "danger" : "success"}
        />
        <KpiCard label="Entreprises" value={groups.size.toString()} tone="primary" />
      </div>

      <div
        style={{
          padding: "0 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {rows.length === 0 ? (
          <Card padding={32} style={{ textAlign: "center" }}>
            <span className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Aucun candidat déployé pour le moment.
            </span>
          </Card>
        ) : (
          Array.from(groups.entries()).map(([enterpriseId, group]) => (
            <Card key={enterpriseId} padding={0}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid hsl(var(--border))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <h3 className="mg-h4" style={{ margin: 0 }}>
                  {group.name}
                </h3>
                <span
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {group.rows.length} candidat{group.rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {group.rows.map((r, i) => {
                  const tone = staleTone(r.daysSinceLatest);
                  const sinceLabel =
                    r.daysSinceLatest === null
                      ? "aucun checkpoint"
                      : r.daysSinceLatest === 0
                        ? "aujourd'hui"
                        : `il y a ${r.daysSinceLatest} j`;
                  const sinceColor =
                    tone === "danger"
                      ? "hsl(var(--destructive))"
                      : tone === "warning"
                        ? "#9A5E08"
                        : "hsl(var(--muted-foreground))";
                  return (
                    <li
                      key={r.applicationId}
                      style={{
                        borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                      }}
                    >
                      <Link
                        href={`/staff/followup/${r.applicationId}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 20px",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        <Avatar name={r.candidateLabel} size={32} />
                        <Stack
                          dir="column"
                          gap={2}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <span
                            className="mg-body-sm"
                            style={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.candidateLabel}
                          </span>
                          <span
                            className="mg-caption"
                            style={{ color: sinceColor }}
                          >
                            Dernier point : {sinceLabel}
                          </span>
                        </Stack>
                        {r.latestStatus ? (
                          <StatusBadge status={r.latestStatus} />
                        ) : (
                          <span
                            className="mg-caption"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Aucun point
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
