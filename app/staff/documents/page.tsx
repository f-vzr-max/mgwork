// Staff documents queue — FIFO over Document.status='PENDING', priority pinned
// on top. Mirrors the `StaffDocumentsArtboard`: KPI bar, filter chips, queue
// table. All Prisma access preserved from the previous implementation; only
// the rendering chrome moved to MG primitives.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/roles";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Stack,
  Icon,
  StatusBadge,
  KpiCard,
} from "@/components/mg";
import type { IconName } from "@/components/mg";

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
  return docs as PendingDoc[];
}

async function loadPriorityCandidateIds(
  candidateIds: string[],
): Promise<Set<string>> {
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

const TYPE_ICON: Record<string, IconName> = {
  PASSPORT: "book-user",
  MEDICAL_AUTHORIZATION: "stethoscope",
  WORK_PERMIT: "briefcase",
  VISA: "stamp",
  INCORPORATION_CERTIFICATE: "building-2",
  OTHER: "file-text",
};

const TYPE_LABEL: Record<string, string> = {
  PASSPORT: "Passeport",
  MEDICAL_AUTHORIZATION: "Médical",
  WORK_PERMIT: "Permis de travail",
  VISA: "Visa",
  INCORPORATION_CERTIFICATE: "Constitution",
  OTHER: "Autre",
};

function formatAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  return `${days} j`;
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

  // Per-type buckets for the filter chips. Chips are non-functional links —
  // the underlying queue is FIFO and filter wiring lives in a follow-up.
  const typeCounts: Record<string, number> = {};
  for (const r of rows) {
    typeCounts[r.doc.type] = (typeCounts[r.doc.type] ?? 0) + 1;
  }

  // 7-day "processed" approximation — count document.approve|reject from audit.
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const processed7d = await prisma.auditLog.count({
    where: {
      userId: user.id,
      action: { in: ["document.approve", "document.reject"] },
      createdAt: { gte: new Date(Date.now() - SEVEN_DAYS) },
    },
  });

  return (
    <>
      <PageHeader
        title="File de documents"
        subtitle="Premier entré, premier servi · prioritaires d'abord"
        action={
          <Stack dir="row" gap={8}>
            <Button variant="outline" iconLeft="filter">
              Filtres avancés
            </Button>
            <Button iconLeft="check-circle-2">Réclamer le suivant</Button>
          </Stack>
        }
      />

      {/* Stats bar */}
      <div
        style={{
          padding: "0 32px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="En attente"
          value={rows.length.toString()}
          tone="primary"
        />
        <KpiCard
          label="Prioritaires"
          value={pinnedCount.toString()}
          tone={pinnedCount > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Traités (7j)"
          value={processed7d.toString()}
          tone="success"
        />
        <KpiCard
          label="Types distincts"
          value={Object.keys(typeCounts).length.toString()}
        />
      </div>

      {/* Filter chips */}
      <div
        style={{
          padding: "0 32px 16px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Badge tone="primary" size="md">
          Tous · {rows.length}
        </Badge>
        {pinnedCount > 0 && (
          <Badge tone="warning" size="md" icon="alert-triangle">
            Prioritaires · {pinnedCount}
          </Badge>
        )}
        {Object.entries(typeCounts).map(([t, n]) => (
          <Badge key={t} tone="neutral" size="md">
            {TYPE_LABEL[t] ?? t} · {n}
          </Badge>
        ))}
      </div>

      {/* Queue table */}
      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={0}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "110px minmax(0, 1fr) 140px 120px 140px 200px",
              padding: "10px 20px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
            className="mg-micro"
          >
            <span>Réf.</span>
            <span>Candidat · Type</span>
            <span>Statut</span>
            <span>Âge file</span>
            <span>Priorité</span>
            <span style={{ textAlign: "right" }}>Action</span>
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
              La file est vide. Rien à vérifier pour l&apos;instant.
            </div>
          ) : (
            rows.map(({ doc, pinned }, i) => {
              const ownerLabel = doc.candidate
                ? `${doc.candidate.firstName} ${doc.candidate.lastName}`
                : doc.enterprise?.companyName ?? "—";
              const icon: IconName = TYPE_ICON[doc.type] ?? "file-text";
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "110px minmax(0, 1fr) 140px 120px 140px 200px",
                    padding: "14px 20px",
                    alignItems: "center",
                    borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                    gap: 8,
                  }}
                >
                  <span
                    className="mg-mono"
                    style={{
                      fontSize: 12,
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {doc.id.slice(0, 8)}
                  </span>
                  <Stack dir="row" gap={12} align="center" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: "hsl(var(--surface-3))",
                        color: "hsl(var(--foreground))",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <Icon name={icon} size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="mg-body-sm"
                        style={{
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ownerLabel}
                      </div>
                      <div
                        className="mg-mono"
                        style={{
                          fontSize: 11,
                          color: "hsl(var(--muted-foreground))",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {TYPE_LABEL[doc.type] ?? doc.type}
                      </div>
                    </div>
                  </Stack>
                  <StatusBadge status={doc.status} />
                  <span
                    className="mg-tabular mg-body-sm"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {formatAge(doc.createdAt)}
                  </span>
                  <span>
                    {pinned ? (
                      <Badge tone="warning" icon="alert-triangle">
                        Prioritaire
                      </Badge>
                    ) : (
                      <span
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        —
                      </span>
                    )}
                  </span>
                  <Stack dir="row" gap={6} justify="flex-end">
                    <Link
                      href={`/staff/documents/${doc.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Button variant="ghost" size="sm" iconLeft="eye">
                        Aperçu
                      </Button>
                    </Link>
                    <Link
                      href={`/staff/documents/${doc.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Button size="sm">Réclamer</Button>
                    </Link>
                  </Stack>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}
