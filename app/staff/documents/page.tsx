import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueueRow } from "@/components/staff/QueueRow";
import { StatsBar } from "@/components/staff/StatsBar";

// Staff documents queue. FIFO over Document.status='PENDING' ordered by
// createdAt ASC. We pin to the top any pending document whose owner-candidate
// has an Application with aiScore >= 80 (proxy for "high-priority candidate"),
// since the schema does not carry an explicit priority flag on Document.
//
// Server component — Prisma reads, no client JS.

export const dynamic = "force-dynamic";

const PRIORITY_AI_SCORE_THRESHOLD = 80;

type PendingDoc = {
  id: string;
  type: string;
  status: "PENDING";
  createdAt: Date;
  candidateId: string | null;
  enterpriseId: string | null;
  candidate: { firstName: string; lastName: string; id: string } | null;
  enterprise: { companyName: string; id: string } | null;
};

async function loadPending(): Promise<PendingDoc[]> {
  const docs = await prisma.document.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      candidateId: true,
      enterpriseId: true,
      candidate: { select: { id: true, firstName: true, lastName: true } },
      enterprise: { select: { id: true, companyName: true } },
    },
  });
  // Type narrowed: status is constant 'PENDING' here.
  return docs as PendingDoc[];
}

async function loadPriorityCandidateIds(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const apps = await prisma.application.findMany({
    where: {
      candidateId: { in: candidateIds },
      aiScore: { gte: PRIORITY_AI_SCORE_THRESHOLD },
    },
    select: { candidateId: true },
  });
  return new Set(apps.map((a) => a.candidateId));
}

export default async function StaffDocumentsQueuePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) redirect("/sign-in");
  if (!canAccess(user.role as Role, "staff")) redirect("/");

  const pending = await loadPending();
  const candidateIds = pending
    .map((d) => d.candidateId)
    .filter((id): id is string => Boolean(id));
  const priorityCandidates = await loadPriorityCandidateIds(candidateIds);

  // Stable sort: pinned first (preserving createdAt asc within group), then non-pinned.
  const rows = pending
    .map((d) => ({
      doc: d,
      pinned: d.candidateId ? priorityCandidates.has(d.candidateId) : false,
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.doc.createdAt.getTime() - b.doc.createdAt.getTime();
    });

  const pinnedCount = rows.filter((r) => r.pinned).length;

  return (
    <>
      <PageHeader
        title="Document queue"
        description={`${pending.length} pending${pinnedCount > 0 ? ` · ${pinnedCount} priority` : ""}`}
      />
      <div className="space-y-6 p-6">
        <StatsBar internalUserId={user.id} />

        <Card>
          <CardHeader>
            <CardTitle>Pending review (FIFO)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Queue is empty. Nothing pending right now.
              </p>
            ) : (
              <div className="divide-y">
                {rows.map(({ doc, pinned }) => {
                  const ownerLabel = doc.candidate
                    ? `${doc.candidate.firstName} ${doc.candidate.lastName}`
                    : doc.enterprise?.companyName ?? "Unknown";
                  const ownerKind: "candidate" | "enterprise" = doc.candidate ? "candidate" : "enterprise";
                  return (
                    <QueueRow
                      key={doc.id}
                      documentId={doc.id}
                      type={doc.type}
                      status={doc.status}
                      ownerLabel={ownerLabel}
                      ownerKind={ownerKind}
                      createdAt={doc.createdAt}
                      pinned={pinned}
                      pinnedReason={pinned ? "High AI score (≥80) on linked application" : undefined}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
