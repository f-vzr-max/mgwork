// MG Work — Candidate matches.
//
// Two modes:
//   - List view (no `?id` query): ranked offers with a ScoreGauge and a
//     compact criteria glance. Tapping a row opens the detail.
//   - Detail view (`?id=<offerId>`): full job detail per
//     `CandidateJobDetailArtboard` — tabbed (match / desc / co), weighted
//     score breakdown, sticky apply CTA.
//
// Server component: resolves the candidate, runs the matching scorer, then
// hands the chosen offer to a small client island for the tab state.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { findOffersForCandidate, type OfferMatch } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
import {
  Badge,
  Card,
  Icon,
  Progress,
  ScoreGauge,
  Stack,
  gaugeTone,
} from "@/components/mg";
import { JobDetailPanel } from "./job-detail-panel";

export const dynamic = "force-dynamic";

// Criterion order + display labels. We sort the breakdown by descending
// weight so the most impactful criterion lands at the top. Labels are resolved
// from the shared `common.criterion.*` catalog so they translate per locale.
type CriterionRow = { key: string; label: string; score: number; weight: number };

function buildCriteriaRows(
  match: OfferMatch,
  weights: Record<string, number>,
  labelFor: (k: string) => string,
): CriterionRow[] {
  const rows: CriterionRow[] = Object.entries(match.breakdown).map(([k, v]) => ({
    key: k,
    label: labelFor(k),
    score: Math.round(Number(v)),
    weight: Math.round((weights[k] ?? 0) * 100),
  }));
  rows.sort((a, b) => b.weight - a.weight);
  return rows;
}

export default async function CandidateMatchesPage({
  searchParams,
}: {
  searchParams?: { id?: string };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.candidate");
  const tc = await getTranslations("common");
  const labelFor = (k: string) => tc(`criterion.${k}`);

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true, candidate: { select: { id: true, profileScore: true } } },
  });
  if (!user) redirect("/onboarding");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <div style={{ padding: 16 }}>
        <Card padding={16}>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("matches.roleGuard")}
          </div>
        </Card>
      </div>
    );
  }

  const weights = await getMatchingWeights();
  const ranked = await findOffersForCandidate(user.candidate.id, weights, 20);
  const ids = ranked.map((m) => m.offerId);
  const offers = ids.length
    ? await prisma.jobOffer.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          description: true,
          sector: true,
          location: true,
          slots: true,
          createdAt: true,
          enterprise: { select: { companyName: true } },
        },
      })
    : [];
  const offersById = new Map(offers.map((o) => [o.id, o]));

  // ── Detail view ────────────────────────────────────────────────────────
  const detailId = searchParams?.id;
  if (detailId) {
    const match = ranked.find((m) => m.offerId === detailId);
    const offer = offersById.get(detailId);
    if (!match || !offer) {
      return (
        <div style={{ padding: 16 }}>
          <Card padding={16}>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("matches.notFound")}
            </div>
            <Link
              href="/candidate/matches"
              style={{
                color: "hsl(var(--primary))",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t("matches.backToAll")}
            </Link>
          </Card>
        </div>
      );
    }
    const rows = buildCriteriaRows(match, weights as unknown as Record<string, number>, labelFor);
    return (
      <JobDetailPanel
        offerId={offer.id}
        title={offer.title}
        description={offer.description}
        sector={offer.sector}
        location={offer.location}
        slots={offer.slots}
        companyName={offer.enterprise.companyName}
        overall={Math.round(match.score)}
        criteria={rows}
        profileScore={user.candidate.profileScore}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="mg-h1" style={{ margin: 0, fontSize: 26, lineHeight: "32px" }}>
          {t("matches.title")}
        </h1>
        <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
          {t("matches.subtitle", { n: Object.keys(weights).length })}
        </div>
      </div>

      {ranked.length === 0 ? (
        <Card padding={16}>
          <div className="mg-h4" style={{ margin: 0 }}>{t("matches.empty.title")}</div>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {t("matches.empty.body")}
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ranked.map((m) => {
            const o = offersById.get(m.offerId);
            if (!o) return null;
            const tone = gaugeTone(m.score);
            return (
              <Link
                key={m.offerId}
                href={`/candidate/matches?id=${m.offerId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Card padding={14}>
                  <Stack dir="row" gap={14} align="center">
                    <ScoreGauge value={m.score} size={56} stroke={4} label={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mg-body-sm" style={{ fontWeight: 600 }}>{o.title}</div>
                      <div
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                      >
                        {o.enterprise.companyName} · {o.location}
                      </div>
                      <div style={{ marginTop: 6, color: tone.color }} className="mg-caption">
                        {tone.label}
                      </div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
                  </Stack>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {Object.entries(m.breakdown).slice(0, 4).map(([k, v]) => (
                      <div key={k}>
                        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 4 }}>
                          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {tc(`criterion.${k}`)}
                          </span>
                          <Badge tone="neutral">{Math.round(Number(v))}</Badge>
                        </Stack>
                        <Progress
                          value={Number(v)}
                          tone={Number(v) >= 80 ? "success" : Number(v) >= 60 ? "primary" : "warning"}
                          height={4}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
