// MG Work — Candidate application detail (M7).
//
// Server component. Shows the application status timeline. When the latest
// interview is upcoming, surfaces its slot. When status=DEPLOYED, mounts the
// DepartureChecklist (interactive, client) + the integration CountryGuide.

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format, isAfter } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import {
  StatusTimeline,
  type ApplicationStatus,
} from "@/components/timeline/StatusTimeline";
import { DepartureChecklist, type ChecklistShape } from "@/components/checklist/DepartureChecklist";
import { CountryGuide, type GuideLang } from "@/components/integration/CountryGuide";

export const dynamic = "force-dynamic";

function coerceChecklist(raw: Prisma.JsonValue | null | undefined): ChecklistShape | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ChecklistShape;
}

export default async function CandidateApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.candidate");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      lang: true,
      role: true,
      candidate: {
        select: {
          id: true,
          departureChecklist: true,
        },
      },
    },
  });
  if (!user) redirect("/sign-in");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <div className="p-6 mg-body-sm text-muted-foreground">
        {t("applicationDetail.profileRequired")}
      </div>
    );
  }

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      candidateId: true,
      notes: true,
      updatedAt: true,
      jobOffer: {
        select: {
          title: true,
          location: true,
          enterprise: { select: { companyName: true } },
        },
      },
      interviews: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          type: true,
          videoUrl: true,
          status: true,
        },
      },
    },
  });
  if (!app) notFound();
  if (app.candidateId !== user.candidate.id) {
    return (
      <div className="p-6 mg-body-sm text-muted-foreground">
        {t("applicationDetail.notYourApplication")}
      </div>
    );
  }

  const upcomingInterview = app.interviews
    .filter((i) => i.status === "SCHEDULED" && isAfter(i.scheduledAt, new Date()))
    .at(0);

  const isDeployed = app.status === "DEPLOYED";
  const checklist = coerceChecklist(user.candidate.departureChecklist ?? null);

  return (
    <>
      <PageHeader
        title={app.jobOffer.title}
        description={`${app.jobOffer.enterprise.companyName} • ${app.jobOffer.location}`}
      />
      <div className="grid gap-6 p-6">
        <section className="rounded-md border bg-card p-4">
          <h2 className="mb-3 mg-h4">{t("applicationDetail.statusSection")}</h2>
          <StatusTimeline current={app.status as ApplicationStatus} />
        </section>

        {app.status === "INTERVIEW_SCHEDULED" && upcomingInterview && (
          <section className="rounded-md border bg-card p-4">
            <h2 className="mb-2 mg-h4">{t("applicationDetail.upcomingInterviewSection")}</h2>
            <p className="mg-body-sm">
              <strong>
                {format(upcomingInterview.scheduledAt, "EEEE d MMMM yyyy, HH:mm")}
              </strong>
              {" "}— {upcomingInterview.type}
            </p>
            {upcomingInterview.videoUrl && (
              <p className="mt-2 mg-body-sm">
                {t("applicationDetail.videoLink")}{" "}
                <a
                  href={upcomingInterview.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {t("applicationDetail.videoLinkOpen")}
                </a>
              </p>
            )}
          </section>
        )}

        {isDeployed && (
          <>
            <section className="rounded-md border bg-card p-4">
              <h2 className="mb-3 mg-h4">{t("applicationDetail.departureChecklistSection")}</h2>
              <DepartureChecklist initial={checklist} />
            </section>

            <section className="rounded-md border bg-card p-4">
              <h2 className="mb-3 mg-h4">
                {t("applicationDetail.welcomeToMauritius")}
              </h2>
              <CountryGuide initialLang={user.lang as GuideLang} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
