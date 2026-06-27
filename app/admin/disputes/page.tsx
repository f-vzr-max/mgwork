// Admin disputes — Kanban view across three lanes: open, in-progress and
// resolved. Server component pulls real Checkpoint rows and a 30d resolved
// window so the "Résolus" column is actually populated.

import Link from "next/link";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Stack,
  Avatar,
  StatusBadge,
  Icon,
  statusLabel,
} from "@/components/mg";
import type { StatusKey } from "@/components/mg";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { DisputeAttachmentsCell } from "./attachments";

export const dynamic = "force-dynamic";

type DisputeCard = {
  id: string;
  name: string;
  co: string;
  days: number;
  status: StatusKey;
  priority: boolean;
  attachments: number;
};

type Column = {
  id: "new" | "inprogress" | "resolved";
  tone: string;
  cards: DisputeCard[];
};

type T = Awaited<ReturnType<typeof getTranslations>>;

function maskName(
  first: string | null | undefined,
  last: string | null | undefined,
  t: T,
): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const lastMasked = l ? `${l.charAt(0).toUpperCase()}.` : "";
  return [f, lastMasked].filter(Boolean).join(" ") || t("disputes.card.unknownCandidate");
}

function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type LoadResult = { columns: Column[]; open: number; priority: number };

async function loadColumns(t: T, priorityOnly: boolean): Promise<LoadResult> {
  const [openRows, resolvedRows] = await Promise.all([
    prisma.checkpoint.findMany({
      where: { status: "INTERVENTION_REQUIRED" },
      orderBy: { date: "desc" },
      take: 60,
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        application: {
          select: {
            jobOffer: { select: { enterprise: { select: { companyName: true } } } },
          },
        },
        _count: { select: { disputeAttachments: true } },
      },
    }),
    prisma.checkpoint.findMany({
      where: {
        status: "OK",
        date: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
      },
      orderBy: { date: "desc" },
      take: 30,
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        application: {
          select: {
            jobOffer: { select: { enterprise: { select: { companyName: true } } } },
          },
        },
        _count: { select: { disputeAttachments: true } },
      },
    }),
  ]);

  // Split open into "new" (<= 3 days) vs "in progress" (older). Without an
  // explicit assignment field on Checkpoint this is the simplest stable split.
  const newCol: DisputeCard[] = [];
  const progCol: DisputeCard[] = [];
  for (const r of openRows) {
    const card: DisputeCard = {
      id: r.id,
      name: maskName(r.candidate?.firstName, r.candidate?.lastName, t),
      co: r.application?.jobOffer?.enterprise?.companyName ?? "—",
      days: daysSince(r.date),
      status: "INTERVENTION_REQUIRED",
      priority: daysSince(r.date) <= 2,
      attachments: r._count.disputeAttachments,
    };
    if (priorityOnly && !card.priority) continue;
    if (card.days <= 3) newCol.push(card);
    else progCol.push(card);
  }

  // Priority view is about open, time-sensitive disputes; resolved is hidden.
  const resolvedCol: DisputeCard[] = priorityOnly ? [] : resolvedRows.map((r) => ({
    id: r.id,
    name: maskName(r.candidate?.firstName, r.candidate?.lastName, t),
    co: r.application?.jobOffer?.enterprise?.companyName ?? "—",
    days: daysSince(r.date),
    status: "COMPLETED",
    priority: false,
    attachments: r._count.disputeAttachments,
  }));

  const columns: Column[] = [
    { id: "new", tone: "hsl(var(--info))", cards: newCol },
    { id: "inprogress", tone: "hsl(var(--warning))", cards: progCol },
    { id: "resolved", tone: "hsl(var(--success))", cards: resolvedCol },
  ];

  return {
    columns,
    open: openRows.length,
    priority: openRows.filter((r) => daysSince(r.date) <= 2).length,
  };
}

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: { priority?: string };
}) {
  const t = await getTranslations("app.admin");
  const tStatus = await getTranslations("status");
  const priorityOnly = searchParams?.priority === "1";
  const { columns, open, priority } = await loadColumns(t, priorityOnly);

  return (
    <>
      <PageHeader
        title={t("disputes.title")}
        subtitle={`${t("disputes.subtitle.dossiers", { open })} · ${t("disputes.subtitle.priority", { priority })}`}
        action={
          <Link
            href={priorityOnly ? "/admin/disputes" : "/admin/disputes?priority=1"}
            style={{ textDecoration: "none" }}
          >
            <Button variant={priorityOnly ? undefined : "outline"} iconLeft="filter">
              {t("disputes.actions.filter")}
            </Button>
          </Link>
        }
      />

      <div
        style={{
          padding: "0 32px 32px",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 0,
            }}
          >
            <Stack dir="row" justify="space-between" align="center">
              <Stack dir="row" gap={10} align="center">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: col.tone,
                  }}
                />
                <span className="mg-h4">{t(`disputes.column.${col.id}`)}</span>
                <Badge tone="neutral">{col.cards.length}</Badge>
              </Stack>
              <button
                type="button"
                aria-label={t("disputes.column.moreActions")}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "hsl(var(--muted-foreground))",
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                <Icon name="more-horizontal" size={16} />
              </button>
            </Stack>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.cards.length === 0 ? (
                <Card
                  padding={16}
                  surface={2}
                  elevation={0}
                  style={{
                    textAlign: "center",
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 13,
                  }}
                >
                  {t("disputes.card.empty")}
                </Card>
              ) : (
                col.cards.map((c) => (
                  <Card key={c.id} padding={16} style={{ position: "relative" }}>
                    {c.priority && (
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          width: 8,
                          height: 8,
                          borderRadius: 9999,
                          background: "hsl(var(--destructive))",
                        }}
                        aria-label={t("disputes.card.priorityDot")}
                      />
                    )}
                    <Stack
                      dir="row"
                      gap={10}
                      align="center"
                      style={{ marginBottom: 10 }}
                    >
                      <Avatar name={c.name} size={32} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="mg-body-sm"
                          style={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.name}
                        </div>
                        <div
                          className="mg-caption"
                          style={{
                            color: "hsl(var(--muted-foreground))",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.co}
                        </div>
                      </div>
                    </Stack>
                    <Stack dir="row" justify="space-between" align="center">
                      <span
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        {col.id === "resolved"
                          ? t("disputes.card.resolvedAgo", { days: c.days })
                          : t("disputes.card.openSince", { days: c.days })}
                      </span>
                      <StatusBadge status={c.status} label={statusLabel(c.status, tStatus)} />
                    </Stack>
                    {/* "+ Add" attachments — opens the shared UploadDialog
                        against /api/admin/disputes/[id]/attachments. */}
                    <DisputeAttachmentsCell
                      checkpointId={c.id}
                      initialCount={c.attachments}
                    />
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
