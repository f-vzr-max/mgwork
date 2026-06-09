// MG Work — Enterprise dashboard.
//
// High-stakes screen. Hifi layout matches `EnterpriseDashboardArtboard`:
//   - 4 KPI cards with sparklines
//   - "Matchs récents" feed with PII-masked candidate names (initial only,
//     full identity revealed via "Voir le profil")
//   - Right rail with current plan, quota usage and KYC document health

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getOfferQuota } from "@/lib/billing";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  KpiCard,
  PageHeader,
  Progress,
  ScoreGauge,
  Stack,
  StatusBadge,
} from "@/components/mg";

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

const PLACEHOLDER_MATCHES: MatchRow[] = [
  {
    applicationId: "m1",
    candidateId: "c1",
    firstName: "Tahiry",
    lastName: "R.",
    city: "Antananarivo",
    sector: "Hôtellerie",
    offerTitle: "Réceptionniste de nuit",
    score: 91,
    status: "PENDING",
  },
  {
    applicationId: "m2",
    candidateId: "c2",
    firstName: "Naina",
    lastName: "A.",
    city: "Mahajanga",
    sector: "Hôtellerie",
    offerTitle: "Réceptionniste de nuit",
    score: 84,
    status: "SHORTLISTED",
  },
  {
    applicationId: "m3",
    candidateId: "c3",
    firstName: "Iary",
    lastName: "L.",
    city: "Toamasina",
    sector: "Cuisine",
    offerTitle: "Commis de cuisine",
    score: 79,
    status: "PENDING",
  },
  {
    applicationId: "m4",
    candidateId: "c4",
    firstName: "Vola",
    lastName: "F.",
    city: "Antsirabe",
    sector: "Hôtellerie",
    offerTitle: "Femme de chambre",
    score: 76,
    status: "INTERVIEW_SCHEDULED",
  },
  {
    applicationId: "m5",
    candidateId: "c5",
    firstName: "Ny Aina",
    lastName: "P.",
    city: "Fianarantsoa",
    sector: "Cuisine",
    offerTitle: "Commis de cuisine",
    score: 71,
    status: "PENDING",
  },
  {
    applicationId: "m6",
    candidateId: "c6",
    firstName: "Tojo",
    lastName: "B.",
    city: "Antananarivo",
    sector: "Hôtellerie",
    offerTitle: "Bagagiste",
    score: 66,
    status: "PENDING",
  },
];

export default async function EnterpriseDashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise.dashboard");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      enterprise: { select: { id: true, companyName: true, plan: true } },
    },
  });
  if (!user) redirect("/onboarding");

  const enterprise = user.enterprise;

  // Live numbers when available — falls back to artboard-style placeholders.
  let matchedCount = 142;
  let interviewsThisWeek = 9;
  let avgDays = 11;
  // Active-offers KPI and the rail are single-sourced from getOfferQuota():
  // `offersUsed` is the quota's `active` count and drives both the KPI value
  // and the rail "used / limit" line, so they can never disagree.
  let activeOffersLimit: number | null = null;
  let offersUsed = 0;
  let matches: MatchRow[] = PLACEHOLDER_MATCHES;
  // PLACEHOLDER_MATCHES carry synthetic candidateIds (c1..c6) that do not exist
  // in the DB. Only link "View profile" to a real /enterprise/candidates/[id]
  // when these rows came from real Applications — otherwise the link 404s.
  let matchesAreReal = false;
  let kycExpiringSoon = 1;
  let companyName = t("dashboard.companyFallback");
  let planLabel = t("dashboard.planFallback", { tier: "Business" });

  if (enterprise) {
    companyName = enterprise.companyName;
    planLabel = t("dashboard.planFallback", { tier: enterprise.plan ?? "FREE" });

    const [applicationsAgg, weekStart, quota, recentApps, docs] = await Promise.all([
      prisma.application.count({
        where: { jobOffer: { enterpriseId: enterprise.id } },
      }),
      Promise.resolve(startOfThisWeek()),
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
    ]);

    matchedCount = applicationsAgg || matchedCount;

    interviewsThisWeek = await prisma.interview.count({
      where: {
        application: { jobOffer: { enterpriseId: enterprise.id } },
        scheduledAt: { gte: weekStart },
      },
    });

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

  const presetUsed = 3;
  const presetLimit = 5;
  const presetPct = Math.round((presetUsed / presetLimit) * 100);
  const offerPct = activeOffersLimit
    ? Math.round((offersUsed / activeOffersLimit) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle", { companyName, planLabel, days: 47 })}
        action={
          <Stack dir="row" gap={8}>
            <Button variant="outline" iconLeft="download">
              {t("dashboard.exportButton")}
            </Button>
            <Link href="/enterprise/offers/new" style={{ textDecoration: "none" }}>
              <Button iconLeft="plus">{t("dashboard.newOfferButton")}</Button>
            </Link>
          </Stack>
        }
      />

      <div
        style={{
          padding: "0 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
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
            delta="+2"
            deltaLabel={t("kpi.vsLastWeek")}
            sparkline={[3, 5, 6, 4, 7, 8, 9]}
          />
          <KpiCard
            label={t("kpi.avgDelay")}
            value={String(avgDays)}
            unit={t("kpi.avgDelayUnit")}
            delta="-1"
            deltaTone="success"
            deltaLabel={t("kpi.vsLastWeek")}
            sparkline={[14, 13, 13, 12, 12, 12, 11]}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                        <Avatar name={masked} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <Stack dir="row" gap={8} align="center" wrap>
                            <span
                              className="mg-body-sm mg-mono"
                              style={{ fontWeight: 600 }}
                            >
                              {masked}
                            </span>
                            {m.city && <Badge tone="neutral">{m.city}</Badge>}
                            <Badge tone="neutral">{m.sector}</Badge>
                            <StatusBadge status={m.status} />
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
                        <Stack dir="row" gap={6}>
                          <Button variant="ghost" size="sm">
                            {t("matches.skipButton")}
                          </Button>
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
                        </Stack>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Plan + KYC rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card padding={20}>
              <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 4 }}>
                <span className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {planLabel}
                </span>
                <Badge tone="success" icon="check-circle-2">
                  {t("plan.activeStatus")}
                </Badge>
              </Stack>
              <div className="mg-h2" style={{ margin: "8px 0 0" }}>
                {presetUsed} / {presetLimit}
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
              >
                {t("plan.preselectionsUsed")}
              </div>
              <Progress value={presetPct} />
              <Hairline style={{ margin: "16px 0" }} />
              <div className="mg-body-sm" style={{ fontWeight: 600, marginBottom: 8 }}>
                {t("plan.activeOffersLabel")}
              </div>
              <div className="mg-h2" style={{ margin: 0 }}>
                {offersUsed} / {activeOffersLimit ?? "∞"}
              </div>
              <Progress value={offerPct} style={{ marginTop: 8 }} />
              <Link
                href="/tarifs"
                style={{ textDecoration: "none", display: "block", marginTop: 16 }}
              >
                <Button variant="outline" fullWidth iconRight="arrow-up-right">
                  {t("plan.upgradeButton")}
                </Button>
              </Link>
            </Card>

            <Card padding={20}>
              <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 12 }}>
                <h3 className="mg-h4" style={{ margin: 0 }}>
                  {t("kyc.title")}
                </h3>
                {kycExpiringSoon > 0 ? (
                  <Badge tone="warning" icon="alert-triangle">
                    {t("kyc.expiringSoon", { count: kycExpiringSoon })}
                  </Badge>
                ) : (
                  <Badge tone="success" icon="check-circle-2">
                    {t("kyc.upToDate")}
                  </Badge>
                )}
              </Stack>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { name: t("kyc.docIncorporation"), icon: "building-2", status: "APPROVED" },
                  { name: t("kyc.docSignatoryPower"), icon: "file-text", status: "APPROVED" },
                  {
                    name: t("kyc.docTaxClearance"),
                    icon: "file-text",
                    status: kycExpiringSoon > 0 ? "EXPIRING_SOON" : "APPROVED",
                  },
                ].map((d) => (
                  <Stack key={d.name} dir="row" gap={10} align="center">
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "hsl(var(--surface-3))",
                        color: "hsl(var(--foreground))",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={d.icon} size={14} />
                    </div>
                    <span className="mg-body-sm" style={{ flex: 1, minWidth: 0 }}>
                      {d.name}
                    </span>
                    <StatusBadge status={d.status} />
                  </Stack>
                ))}
              </div>
              <Link
                href="/enterprise/documents"
                style={{ textDecoration: "none", display: "block", marginTop: 16 }}
              >
                <Button variant="outline" fullWidth iconRight="arrow-right">
                  {t("kyc.manageButton")}
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function startOfThisWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const offset = (day + 6) % 7; // Mon=0
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
  return d;
}
