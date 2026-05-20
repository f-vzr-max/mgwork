// MG Work — Enterprise interviews calendar.
//
// Server component. Reads interviews owned by the calling enterprise for a
// given month (?month=YYYY-MM, default current). Renders a MonthGrid +
// per-month upcoming list, all wrapped in MG chrome so it matches the rest of
// the enterprise area.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format, addMonths, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { MonthGrid, type CalendarItem } from "@/components/calendar/MonthGrid";
import {
  Badge,
  Button,
  Card,
  Hairline,
  PageHeader,
  Stack,
  StatusBadge,
} from "@/components/mg";

export const dynamic = "force-dynamic";

function parseMonth(raw: string | undefined): Date {
  const now = new Date();
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-");
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function maskName(first: string, last: string): string {
  const a = first?.[0]?.toUpperCase() ?? "?";
  const b = last?.[0]?.toUpperCase() ?? "?";
  return `${a}*** ${b}.`;
}

export default async function EnterpriseInterviewsPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      enterprise: { select: { id: true } },
    },
  });
  if (!user) redirect("/sign-in");

  if (user.role !== "ENTERPRISE" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return <PageHeader title="Accès refusé" subtitle="Permission insuffisante." />;
  }

  const month = parseMonth(searchParams?.month);
  const monthStart = month;
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

  const where =
    user.role === "ENTERPRISE" && user.enterprise
      ? {
          application: { jobOffer: { enterpriseId: user.enterprise.id } },
          scheduledAt: { gte: monthStart, lt: monthEnd },
        }
      : { scheduledAt: { gte: monthStart, lt: monthEnd } };

  const interviews = await prisma.interview.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      type: true,
      status: true,
      application: {
        select: {
          candidate: { select: { firstName: true, lastName: true } },
          jobOffer: { select: { title: true } },
        },
      },
    },
  });

  const items: CalendarItem[] = interviews.map((i) => {
    const masked = maskName(
      i.application.candidate.firstName,
      i.application.candidate.lastName,
    );
    return {
      id: i.id,
      date: i.scheduledAt,
      label: `${format(i.scheduledAt, "HH:mm")} ${masked}`,
      href: `/enterprise/interviews/${i.id}`,
    };
  });

  const prevMonth = format(subMonths(month, 1), "yyyy-MM");
  const nextMonth = format(addMonths(month, 1), "yyyy-MM");

  const scheduledCount = interviews.filter((i) => i.status === "SCHEDULED").length;
  const doneCount = interviews.filter((i) => i.status === "DONE" || i.status === "COMPLETED").length;

  return (
    <>
      <PageHeader
        title="Entretiens"
        subtitle={`Planning du mois · ${format(month, "MMMM yyyy")}`}
        action={
          <Stack dir="row" gap={8}>
            <Link
              href={`/enterprise/interviews?month=${prevMonth}`}
              style={{ textDecoration: "none" }}
            >
              <Button variant="outline" iconLeft="chevron-left">
                Précédent
              </Button>
            </Link>
            <Link
              href={`/enterprise/interviews?month=${nextMonth}`}
              style={{ textDecoration: "none" }}
            >
              <Button variant="outline" iconRight="chevron-right">
                Suivant
              </Button>
            </Link>
          </Stack>
        }
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={20}>
          <Stack dir="row" gap={8} style={{ marginBottom: 12 }}>
            <Badge tone="info" size="md">
              Planifiés · {scheduledCount}
            </Badge>
            <Badge tone="success" size="md">
              Terminés · {doneCount}
            </Badge>
            <Badge tone="neutral" size="md">
              Total · {interviews.length}
            </Badge>
          </Stack>
          <MonthGrid month={month} items={items} />
        </Card>

        <Card padding={0}>
          <div style={{ padding: "14px 20px" }}>
            <h3 className="mg-h4" style={{ margin: 0 }}>
              Ce mois-ci
            </h3>
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
            >
              Identités masquées avant entretien · règle PII Plan Business
            </div>
          </div>
          <Hairline />
          {interviews.length === 0 ? (
            <p
              className="mg-body-sm"
              style={{ padding: "16px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              Aucun entretien planifié pour ce mois.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {interviews.map((i, idx) => {
                const masked = maskName(
                  i.application.candidate.firstName,
                  i.application.candidate.lastName,
                );
                return (
                  <li
                    key={i.id}
                    style={{
                      padding: "14px 20px",
                      borderTop: idx === 0 ? 0 : "1px solid hsl(var(--border))",
                    }}
                  >
                    <Link
                      href={`/enterprise/interviews/${i.id}`}
                      style={{
                        textDecoration: "none",
                        color: "hsl(var(--foreground))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="mg-body-sm" style={{ fontWeight: 600 }}>
                          {format(i.scheduledAt, "EEE d MMM · HH:mm")}
                        </div>
                        <div
                          className="mg-caption"
                          style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                        >
                          <span className="mg-mono">{masked}</span> · {i.application.jobOffer.title}
                        </div>
                      </div>
                      <Stack dir="row" gap={6} align="center">
                        <Badge tone="neutral">{i.type}</Badge>
                        <StatusBadge status={i.status} />
                      </Stack>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
