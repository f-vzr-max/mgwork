// MG Work — Browse candidates (MG hifi refresh).
//
// Server component. Filters via URL search params:
//   ?sector=Construction
//   ?lang=FR  (uppercase code; filter is "lang score >= 60")
//   ?skills=welding,forklift  (comma-separated; matches any)
//   ?cursor=<candidateId>  (cursor pagination over Candidate.id)
//
// PII is masked at the list level: enterprises see initials only until the
// candidate is moved into a shortlist (out of scope for this skeleton — the
// "Voir le profil" CTA is the reveal path).

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Hairline,
  Input,
  PageHeader,
  ScoreGauge,
  Stack,
} from "@/components/mg";
import {
  CandidateActionBar,
  OfferSelector,
  OfferSelectorProvider,
  type OfferOption,
} from "@/components/mg/candidate-action-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Search = {
  sector?: string;
  lang?: string;
  skills?: string;
  cursor?: string;
};

function buildHref(base: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v && v.length > 0) qs.set(k, v);
  }
  const s = qs.toString();
  return "/enterprise/candidates" + (s ? "?" + s : "");
}

function maskName(first: string, last: string): string {
  const a = first?.[0]?.toUpperCase() ?? "?";
  const b = last?.[0]?.toUpperCase() ?? "?";
  return `${a}*** ${b}.`;
}

// `value` is the DB/URL filter value (stored in French) and stays untranslated;
// only the displayed `labelKey` is localized so EN users keep working filters.
const QUICK_SECTORS: { value: string; labelKey: string }[] = [
  { value: "Hôtellerie", labelKey: "candidates.filter.quickSector.hotellerie" },
  { value: "Cuisine", labelKey: "candidates.filter.quickSector.cuisine" },
  { value: "Construction", labelKey: "candidates.filter.quickSector.construction" },
  { value: "Santé", labelKey: "candidates.filter.quickSector.sante" },
  { value: "Logistique", labelKey: "candidates.filter.quickSector.logistique" },
];

export default async function BrowseCandidatesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise");
  const tc = await getTranslations("common");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) redirect("/onboarding");
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin && user.role !== "ENTERPRISE") {
    return (
      <PageHeader title={t("candidates.accessDenied")} subtitle={t("candidates.accessDeniedSubtitle")} />
    );
  }

  // Target-offer selector source: the enterprise's own ACTIVE offers. Admins
  // (no enterprise profile) get no offers, so the Pass/Shortlist actions stay
  // disabled — they only browse. The owning enterprise is the session user's.
  let activeOffers: OfferOption[] = [];
  if (user.role === "ENTERPRISE" && user.enterprise) {
    const offers = await prisma.jobOffer.findMany({
      where: { enterpriseId: user.enterprise.id, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
      take: 100,
    });
    activeOffers = offers.map((o) => ({ id: o.id, title: o.title }));
  }

  const sector = (searchParams.sector ?? "").trim();
  const lang = (searchParams.lang ?? "").toUpperCase();
  const skillsCsv = (searchParams.skills ?? "").trim();
  const skills = skillsCsv.length
    ? skillsCsv.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const where: Prisma.CandidateWhereInput = {};
  if (sector) where.sectors = { has: sector };
  if (skills.length) where.skills = { hasSome: skills };
  if (lang === "FR") where.langScoreFR = { gte: 60 };
  else if (lang === "EN") where.langScoreEN = { gte: 60 };

  const cursorId = searchParams.cursor;
  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: true,
      langScoreFR: true,
      langScoreEN: true,
      profileScore: true,
      skills: true,
      sectors: true,
    },
  });
  const hasMore = candidates.length > PAGE_SIZE;
  const page = hasMore ? candidates.slice(0, PAGE_SIZE) : candidates;
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

  return (
    <OfferSelectorProvider offers={activeOffers}>
      <PageHeader
        title={t("candidates.title")}
        subtitle={t("candidates.subtitle")}
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={20}>
          <form method="get" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Stack dir="row" gap={8} wrap>
              {QUICK_SECTORS.map((qs) => {
                const active = sector === qs.value;
                return (
                  <Link
                    key={qs.value}
                    href={buildHref({ sector: active ? "" : qs.value, lang, skills: skillsCsv })}
                    style={{ textDecoration: "none" }}
                  >
                    <Badge tone={active ? "primary" : "neutral"} size="md">
                      {t(qs.labelKey)}
                    </Badge>
                  </Link>
                );
              })}
            </Stack>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 2fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <Input name="sector" defaultValue={sector} placeholder={t("candidates.filter.sectorPlaceholder")} />
              <select
                name="lang"
                defaultValue={lang}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--input))",
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  padding: "0 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                <option value="">{t("candidates.filter.langDefault")}</option>
                <option value="FR">FR</option>
                <option value="EN">EN</option>
              </select>
              <Input
                name="skills"
                defaultValue={skillsCsv}
                placeholder={t("candidates.filter.skillsPlaceholder")}
              />
              <Stack dir="row" gap={8}>
                <Button type="submit" iconLeft="filter">
                  {tc("apply")}
                </Button>
                <Link href="/enterprise/candidates" style={{ textDecoration: "none" }}>
                  <Button type="button" variant="outline">
                    {tc("reset")}
                  </Button>
                </Link>
              </Stack>
            </div>
          </form>
        </Card>

        <Card padding={0}>
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 className="mg-h4" style={{ margin: 0 }}>
              {t("candidates.list.countLabel", {
                count: page.length,
                partial: hasMore ? t("candidates.list.partialSuffix") : "",
              })}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <OfferSelector />
              <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
                {t("candidates.list.piiNotice")}
              </span>
            </div>
          </div>
          <Hairline />
          {page.length === 0 ? (
            <div
              className="mg-body-sm"
              style={{ padding: "24px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              {t("candidates.list.empty")}
            </div>
          ) : (
            <div>
              {page.map((c, i) => {
                const masked = maskName(c.firstName, c.lastName);
                const topSkills = c.skills.slice(0, 4);
                return (
                  <div
                    key={c.id}
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
                          <span className="mg-body-sm mg-mono" style={{ fontWeight: 600 }}>
                            {masked}
                          </span>
                          {c.city && <Badge tone="neutral">{c.city}</Badge>}
                          {c.sectors[0] && <Badge tone="neutral">{c.sectors[0]}</Badge>}
                          {topSkills.map((s) => (
                            <Badge key={s} tone="info">
                              {s}
                            </Badge>
                          ))}
                        </Stack>
                        <div
                          className="mg-caption"
                          style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}
                        >
                          {t("candidates.card.scoreCaption", {
                            fr: c.langScoreFR ?? "—",
                            en: c.langScoreEN ?? "—",
                            score: c.profileScore,
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <ScoreGauge value={c.profileScore} size={44} stroke={4} label={false} />
                      <CandidateActionBar candidateId={c.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasMore && (
            <>
              <Hairline />
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Link
                  href={buildHref({ sector, lang, skills: skillsCsv, cursor: nextCursor })}
                  style={{ textDecoration: "none" }}
                >
                  <Button variant="outline" iconRight="chevron-right">
                    {tc("next")}
                  </Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </OfferSelectorProvider>
  );
}
