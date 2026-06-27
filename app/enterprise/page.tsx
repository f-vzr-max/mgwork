// MG Work — Enterprise dashboard.
//
// High-stakes screen. Hifi layout matches `EnterpriseDashboardArtboard`:
//   - 4 KPI cards with sparklines
//   - "Matchs récents" feed with PII-masked candidate names (initial only,
//     full identity revealed via "Voir le profil")
//   - Right rail with current plan, quota usage and KYC document health

import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getOfferQuota } from "@/lib/billing";
import { sectorLabel } from "@/lib/sectors";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Hairline,
  KpiCard,
  PageHeader,
  ScoreGauge,
  Stack,
  StatusBadge,
  statusLabel,
} from "@/components/mg";
import { EnterprisePlanKycRail } from "@/components/mg/enterprise-plan-kyc-rail";

export const dynamic = "force-dynamic";

type MatchRow = {
  applicationId: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  city: string | null;
  sector: string;
  offerTitle: string;
  score: number;
  status: string;
};

function maskName(first: string, last: string): string {
  const initial = first?.[0]?.toUpperCase() ?? "?";
  const lastInitial = last?.[0]?.toUpperCase() ?? "?";
  return `${initial}*** ${lastInitial}.`;
}

function startOfThisWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = (day + 6) % 7; // Mon=0
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
  return d;
}

export default async function EnterpriseDashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise.dashboard");
  const tStatus = await getTranslations("status");
  const tEnt = await getTranslations("app.enterprise");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      enterprise: { select: { id: true, companyName: true, plan: true } },
    },
  });
  if (!user) redirect("/onboarding");

  const enterprise = user.enterprise;

  let matchedCount = 142;
  let avgDays = 11;
  let activeOffersLimit: number | null = null;
  let offersUsed = 0;
  let matches: MatchRow[] = [];
  let matchesAreReal = false;
  let kycExpiringSoon = 1;
  let companyName = t("dashboard.companyFallback");
  let planLabel = t("dashboard.planFallback", { tier: "Business" });
  let interviewsThisWeek = 9;
  // v1 default; real source deferred to Path B
  const presetLimit = 5;
  let presetUsed = 0;

  if (enterprise) {
    companyName = enterprise.companyName;
    planLabel = t("dashboard.planFallback", { tier: enterprise.plan ?? "FREE" });

    const weekStart = startOfThisWeek();
    const nowDate = new Date();
    const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
    const [applicationsAgg, quota, recentApps, docs, interviewsCount, presetCount] =
      await Promise.all([
        prisma.application.count({ where: { jobOffer: { enterpriseId: enterprise.id } } }),
        getOfferQuota(enterprise.id),
        prisma.application.findMany({
          where: { jobOffer: { enterpriseId: enterprise.id } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            status: true,
            aiScore: true,
            candidate: {
              select: { id: true, firstName: true, lastName: true, city: true, sectors: true },
            },
            jobOffer: { select: { title: true, sector: true } },
          },
        }),
        prisma.document.findMany({
          where: { enterpriseId: enterprise.id },
          select: { status: true, expiresAt: true },
        }),
        prisma.interview.count({
          where: {
            application: { jobOffer: { enterpriseId: enterprise.id } },
            scheduledAt: { gte: weekStart },
          },
        }),
        prisma.application.count({
          where: {
            status: "SHORTLISTED",
            jobOffer: { enterpriseId: enterprise.id },
            createdAt: { gte: monthStart },
          },
        }),
      ]);

    matchedCount = applicationsAgg || matchedCount;
    interviewsThisWeek = interviewsCount;
    presetUsed = presetCount;

    if (quota) {
      offersUsed = quota.active;
      activeOffersLimit = quota.limit ?? null;
    }

    if (recentApps.length > 0) {
      matchesAreReal = true;
      matches = recentApps.map((a) => ({
        applicationId: a.id,
        candidateId: a.candidate.id,
        firstName: a.candidate.firstName,
        lastName: a.candidate.lastName,
        city: a.candidate.city,
        sector: a.candidate.sectors[0] ?? a.jobOffer.sector,
        offerTitle: a.jobOffer.title,
        score: a.aiScore ?? 0,
        status: a.status,
      }));
    }

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    kycExpiringSoon = docs.filter(
      (d) => d.expiresAt && d.expiresAt.getTime() - now < THIRTY_DAYS,
    ).length;

    // Rough placeholder: time-to-shortlist heuristic — keep artboard value when
    // there is no historical signal yet.
    avgDays = 11;
  }

  const presetPct = Math.round((presetUsed / presetLimit) * 100);
  const offerPct = activeOffersLimit ? Math.round((offersUsed / activeOffersLimit) * 100) : 0;

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle", { companyName, planLabel, days: 47 })}
        action={
          <Stack dir="row" gap={8}>
            <a href="/api/me/data-export" style={{ textDecoration: "none" }}>
              <Button variant="outline" iconLeft="download">
                {t("dashboard.exportButton")}
              </Button>
            </a>
            <Link href="/enterprise/offers/new" style={{ textDecoration: "none" }}>
              <Button iconLeft="plus">{t("dashboard.newOfferButton")}</Button>
            </Link>
          </Stack>
        }
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={t("kpi.activeOffers")}
            value={String(offersUsed)}
            sparkline={[2, 2, 3, 3, 4, 3, 4]}
          />
          <KpiCard
            label={t("kpi.matchedCandidates")}
            value={String(matchedCount)}
            sparkline={[80, 92, 110, 118, 128, 135, 142]}
          />
          <KpiCard
            label={t("kpi.interviewsThisWeek")}
            value={String(interviewsThisWeek)}
            sparkline={[3, 5, 6, 4, 7, 8, 9]}
          />
          <KpiCard
            label={t("kpi.avgDelay")}
            value={String(avgDays)}
            unit={t("kpi.avgDelayUnit")}
            sparkline={[14, 13, 13, 12, 12, 12, 11]}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
          {/* Matches feed */}
          <Card padding={0}>
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h3 className="mg-h4" style={{ margin: 0 }}>
                  {t("matches.title")}
                </h3>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                >
                  {t("matches.piiNotice", { planLabel })}
                </div>
              </div>
              <Stack dir="row" gap={6}>
                <Badge tone="primary" size="md">
                  {t("matches.badgeAll", { count: matchedCount })}
                </Badge>
                <Badge tone="neutral" size="md">
                  {t("matches.badgeNew", { count: 14 })}
                </Badge>
              </Stack>
            </div>
            <Hairline />
            <div>
              {matches.length === 0 ? (
                <div
                  className="mg-body-sm"
                  style={{ padding: "24px 20px", color: "hsl(var(--muted-foreground))" }}
                >
                  {t("matches.empty")}
                </div>
              ) : (
                matches.map((m, i) => {
                  const masked = maskName(m.firstName, m.lastName);
                  return (
                    <div
                      key={m.applicationId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 20px",
                        borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}
                      >
                        <Avatar name={masked} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <Stack dir="row" gap={8} align="center" wrap>
                            <span className="mg-body-sm mg-mono" style={{ fontWeight: 600 }}>
                              {masked}
                            </span>
                            {m.city && <Badge tone="neutral">{m.city}</Badge>}
                            <Badge tone="neutral">{sectorLabel(m.sector, tEnt)}</Badge>
                            <StatusBadge
                              status={m.status}
                              label={statusLabel(m.status, tStatus)}
                            />
                          </Stack>
                          <div
                            className="mg-caption"
                            style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                          >
                            {t("matches.forOffer", { offerTitle: m.offerTitle })}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ScoreGauge value={m.score} size={44} stroke={4} label={false} />
                        {matchesAreReal ? (
                          <Link
                            href={`/enterprise/candidates/${m.candidateId}`}
                            style={{ textDecoration: "none" }}
                          >
                            <Button size="sm">{t("matches.viewProfileButton")}</Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled>
                            {t("matches.viewProfileButton")}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Plan + KYC rail */}
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minHeight: 320,
                  opacity: 0.4,
                }}
              >
                <div
                  style={{
                    height: 180,
                    borderRadius: 8,
                    background: "hsl(var(--surface-2))",
                  }}
                />
                <div
                  style={{
                    height: 160,
                    borderRadius: 8,
                    background: "hsl(var(--surface-2))",
                  }}
                />
              </div>
            }
          >
            <EnterprisePlanKycRail
              offersUsed={offersUsed}
              activeOffersLimit={activeOffersLimit}
              offerPct={offerPct}
              presetUsed={presetUsed}
              presetLimit={presetLimit}
              presetPct={presetPct}
              kycExpiringSoon={kycExpiringSoon}
              planLabel={planLabel}
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}
