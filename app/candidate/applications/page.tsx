// MG Work — Candidate applications list.
//
// Server component. Lists every application owned by the signed-in candidate
// with a status badge, a short metadata line, and the canonical
// `StatusTimeline` underneath. Mobile-first: full-bleed cards.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  Card,
  Icon,
  Stack,
  StatusBadge,
} from "@/components/mg";
import {
  StatusTimeline,
  type ApplicationStatus,
} from "@/components/timeline/StatusTimeline";
import { ShortlistAccept } from "@/components/mg/shortlist-accept";

export const dynamic = "force-dynamic";

export default async function CandidateApplicationsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.candidate");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true, candidate: { select: { id: true } } },
  });
  if (!user) redirect("/sign-in");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <div style={{ padding: 16 }}>
        <Card padding={16}>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("applications.missingProfile")}
          </div>
        </Card>
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
          location: true,
          enterprise: { select: { companyName: true } },
        },
      },
    },
  });

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="mg-h1" style={{ margin: 0, fontSize: 26, lineHeight: "32px" }}>
          {t("applications.title")}
        </h1>
        <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
          {t("applications.subtitle")}
        </div>
      </div>

      {apps.length === 0 ? (
        <Card padding={16}>
          <div className="mg-h4" style={{ margin: 0 }}>{t("applications.empty.title")}</div>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {t("applications.empty.body")}
          </div>
          <Link
            href="/candidate/matches"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 12,
              color: "hsl(var(--primary))",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("applications.empty.cta")}
            <Icon name="arrow-right" size={14} />
          </Link>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {apps.map((app) => (
            <Card key={app.id} padding={16}>
              <Stack dir="row" justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    href={`/candidate/applications/${app.id}`}
                    style={{
                      color: "hsl(var(--foreground))",
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: "20px",
                      textDecoration: "none",
                    }}
                  >
                    {app.jobOffer.title}
                  </Link>
                  <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                    {app.jobOffer.enterprise.companyName} · {app.jobOffer.location} · {t("applications.card.updatedAt")}{" "}
                    {format(app.updatedAt, "d MMM yyyy")}
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </Stack>
              <StatusTimeline current={app.status as ApplicationStatus} />
              {app.status === "SHORTLISTED" && (
                <ShortlistAccept applicationId={app.id} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
