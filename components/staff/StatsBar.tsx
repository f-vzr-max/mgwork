import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

// StatsBar — async server component that loads the staff member's
// processing stats from AuditLog (last 7 days).
//
// "Avg time" is approximated as the median time between consecutive
// document.approve|document.reject actions for the same staff user. This
// is a coarse proxy for "time per review" but does not require any new
// schema. If a more accurate metric is later required, store an explicit
// `verifiedAt - createdAt` delta or add a dedicated metrics table.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function loadStats(internalUserId: string): Promise<{
  processed: number;
  approved: number;
  rejected: number;
  avgSecondsBetween: number | null;
}> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: internalUserId,
      action: { in: ["document.approve", "document.reject"] },
      createdAt: { gte: since },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const approved = rows.filter((r) => r.action === "document.approve").length;
  const rejected = rows.filter((r) => r.action === "document.reject").length;
  const processed = approved + rejected;

  let avgSecondsBetween: number | null = null;
  if (rows.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      if (!a || !b) continue;
      const d = (b.createdAt.getTime() - a.createdAt.getTime()) / 1000;
      // Cap to 1 hour to avoid skew from overnight gaps.
      if (d > 0 && d < 3600) deltas.push(d);
    }
    if (deltas.length > 0) {
      deltas.sort((x, y) => x - y);
      const mid = Math.floor(deltas.length / 2);
      const a = deltas[mid - 1] ?? deltas[mid] ?? 0;
      const b = deltas[mid] ?? 0;
      avgSecondsBetween = deltas.length % 2 === 0 ? (a + b) / 2 : b;
    }
  }

  return { processed, approved, rejected, avgSecondsBetween };
}

function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = m / 60;
  return `${h.toFixed(1)}h`;
}

export async function StatsBar({ internalUserId }: { internalUserId: string }) {
  const stats = await loadStats(internalUserId);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Processed (7d)</div>
          <div className="mt-1 text-2xl font-semibold">{stats.processed}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Approved</div>
          <div className="mt-1 text-2xl font-semibold text-green-700">{stats.approved}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Rejected</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{stats.rejected}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Avg time / review</div>
          <div className="mt-1 text-2xl font-semibold">{formatSeconds(stats.avgSecondsBetween)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
