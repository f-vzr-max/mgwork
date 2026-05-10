// MG Work — Enterprise interviews calendar (M7).
//
// Server component. Reads interviews owned by the calling enterprise for a
// given month (?month=YYYY-MM, default current). Renders a MonthGrid with
// scheduled interviews as items.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format, addMonths, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid, type CalendarItem } from "@/components/calendar/MonthGrid";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function parseMonth(raw: string | undefined): Date {
  const now = new Date();
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-");
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
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

  const items: CalendarItem[] = interviews.map((i) => ({
    id: i.id,
    date: i.scheduledAt,
    label: `${format(i.scheduledAt, "HH:mm")} ${i.application.candidate.firstName} ${i.application.candidate.lastName[0]}.`,
    href: `/enterprise/interviews/${i.id}`,
  }));

  const prevMonth = format(subMonths(month, 1), "yyyy-MM");
  const nextMonth = format(addMonths(month, 1), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Scheduled interviews this month."
      >
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/enterprise/interviews?month=${prevMonth}`}>
              ← Previous
            </Link>
          </Button>
          <span className="text-sm font-medium">{format(month, "MMMM yyyy")}</span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/enterprise/interviews?month=${nextMonth}`}>
              Next →
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="p-6">
        <MonthGrid month={month} items={items} />

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">This month</h2>
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interviews scheduled.
            </p>
          ) : (
            <ul className="grid gap-2">
              {interviews.map((i) => (
                <li key={i.id} className="rounded-md border bg-card p-3 text-sm">
                  <Link
                    href={`/enterprise/interviews/${i.id}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      <strong>{format(i.scheduledAt, "EEE d MMM, HH:mm")}</strong>
                      {" — "}
                      {i.application.candidate.firstName}{" "}
                      {i.application.candidate.lastName}
                      {" • "}
                      {i.application.jobOffer.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {i.type} • {i.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
