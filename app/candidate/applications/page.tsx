// MG Work — Candidate applications list (M7).
//
// Replaces the placeholder route with a real list of the signed-in candidate's
// applications, each rendered with a status timeline.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import {
  StatusTimeline,
  type ApplicationStatus,
} from "@/components/timeline/StatusTimeline";

export const dynamic = "force-dynamic";

export default async function CandidateApplicationsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      candidate: { select: { id: true } },
    },
  });
  if (!user) redirect("/sign-in");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Candidate profile required.
      </div>
    );
  }

  const apps = await prisma.application.findMany({
    where: { candidateId: user.candidate.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      jobOffer: {
        select: {
          id: true,
          title: true,
          enterprise: { select: { companyName: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="My applications"
        description="Status of every job offer you've applied to."
      />
      <div className="grid gap-4 p-6">
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          apps.map((app) => (
            <article
              key={app.id}
              className="rounded-md border bg-card p-4 shadow-sm"
            >
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Link
                    href={`/candidate/applications/${app.id}`}
                    className="text-base font-semibold hover:underline"
                  >
                    {app.jobOffer.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {app.jobOffer.enterprise.companyName} • Updated{" "}
                    {format(app.updatedAt, "d MMM yyyy")}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {app.status}
                </span>
              </header>
              <StatusTimeline current={app.status as ApplicationStatus} />
            </article>
          ))
        )}
      </div>
    </>
  );
}
