import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckpointStatusBadge, type CheckpointStatusValue } from "@/components/staff/StatusBadge";

// Follow-up dashboard: lists DEPLOYED applications grouped by enterprise.
// Each row surfaces:
//   - candidate name
//   - latest CheckpointStatus (OK / ALERT / INTERVENTION_REQUIRED)
//   - days since last checkpoint
//
// Server component; Prisma reads with a single grouped query plan.

export const dynamic = "force-dynamic";

type DeployedRow = {
  applicationId: string;
  enterpriseId: string;
  enterpriseName: string;
  candidateLabel: string;
  latestStatus: CheckpointStatusValue | null;
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
      latest != null ? Math.floor((now - latest.date.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return {
      applicationId: a.id,
      enterpriseId: a.jobOffer.enterprise.id,
      enterpriseName: a.jobOffer.enterprise.companyName,
      candidateLabel: `${a.candidate.firstName} ${a.candidate.lastName}`,
      latestStatus: (latest?.status ?? null) as CheckpointStatusValue | null,
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
  const totalAlerts = rows.filter((r) => r.latestStatus === "ALERT" || r.latestStatus === "INTERVENTION_REQUIRED").length;

  return (
    <>
      <PageHeader
        title="Follow-up"
        description={`${rows.length} deployed candidates · ${totalAlerts} need attention`}
      />
      <div className="space-y-6 p-6">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No deployed candidates yet.
            </CardContent>
          </Card>
        ) : (
          Array.from(groups.entries()).map(([enterpriseId, group]) => (
            <Card key={enterpriseId}>
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {group.rows.map((r) => {
                    const tone = staleTone(r.daysSinceLatest);
                    const sinceLabel =
                      r.daysSinceLatest === null
                        ? "no checkpoint yet"
                        : r.daysSinceLatest === 0
                          ? "today"
                          : `${r.daysSinceLatest}d ago`;
                    const sinceClass =
                      tone === "danger"
                        ? "text-red-700"
                        : tone === "warning"
                          ? "text-amber-700"
                          : "text-muted-foreground";
                    return (
                      <li key={r.applicationId}>
                        <Link
                          href={`/staff/followup/${r.applicationId}`}
                          className="flex items-center gap-4 px-6 py-3 hover:bg-accent/50"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium">{r.candidateLabel}</div>
                            <div className={`text-xs ${sinceClass}`}>Last checkpoint: {sinceLabel}</div>
                          </div>
                          <div>
                            {r.latestStatus ? (
                              <CheckpointStatusBadge status={r.latestStatus} />
                            ) : (
                              <span className="text-xs text-muted-foreground">No checkpoint</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
