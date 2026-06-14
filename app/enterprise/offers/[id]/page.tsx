// MG Work — Offer detail + shortlist (M5).
//
// Server component. Loads the offer (with ownership check), recomputes the
// shortlist live (top 5 candidates by compatibility score), and renders both.
// Recompute is in-process — it does not require Claude — so this is cheap to
// re-run on every page render. We still upsert into the Matching table so the
// dashboard counters and downstream views stay consistent.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeMatchings } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/mg";

export const dynamic = "force-dynamic";

// PII reveal threshold: ACCEPTED and beyond (decision G — identity is revealed
// only after the candidate ACCEPTS a shortlist, not on the shortlist alone).
// The AI shortlist below is a LIVE matching recompute (a ranking signal) — it is
// NOT a formal shortlist, so a candidate appearing here does not unlock their
// identity. Reveal requires a real Application at ACCEPTED+ under THIS
// enterprise's offers (DB-level).
const REVEAL_STATUSES: ApplicationStatus[] = [
  "ACCEPTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_DONE",
  "OFFER_MADE",
  "DEPLOYED",
  "COMPLETED",
];

function maskName(first: string, last: string): string {
  const a = first?.[0]?.toUpperCase() ?? "?";
  const b = last?.[0]?.toUpperCase() ?? "?";
  return `${a}*** ${b}.`;
}

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise");
  const tc = await getTranslations("common");
  const tl = await getTranslations("langTest");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      enterprise: { select: { id: true } },
    },
  });
  if (!user) redirect("/onboarding");

  const offer = await prisma.jobOffer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      enterpriseId: true,
      title: true,
      description: true,
      sector: true,
      location: true,
      slots: true,
      status: true,
      requirements: true,
      langRequired: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
  });
  if (!offer) notFound();

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isOwner = user.enterprise?.id === offer.enterpriseId;
  if (!isAdmin && !isOwner) {
    return (
      <>
        <PageHeader title={t("offerDetail.forbidden.title")} description={t("offerDetail.forbidden.description")} />
      </>
    );
  }

  const weights = await getMatchingWeights();
  const top = await recomputeMatchings(offer.id, weights, 5);

  // Fetch candidate display data for the shortlist.
  const candidateIds = top.map((m) => m.candidateId);
  const candidates = candidateIds.length
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          langScoreFR: true,
          langScoreEN: true,
          langScoreFRVerifiedAt: true,
          langScoreENVerifiedAt: true,
          skills: true,
          sectors: true,
        },
      })
    : [];
  const byId = new Map(candidates.map((c) => [c.id, c]));

  // Per-candidate PII gate. Admins see every name. The owning enterprise sees a
  // name only for candidates with an Application at SHORTLISTED+ under one of
  // its own offers — a DB-level relationship check, never a client flag and
  // never the live-ranking presence in this list. Resolved in a single query
  // scoped to this enterprise's offers, then turned into a reveal set.
  const revealedIds = new Set<string>();
  if (isAdmin) {
    for (const id of candidateIds) revealedIds.add(id);
  } else if (isOwner && user.enterprise && candidateIds.length) {
    const apps = await prisma.application.findMany({
      where: {
        candidateId: { in: candidateIds },
        status: { in: REVEAL_STATUSES },
        jobOffer: { enterpriseId: user.enterprise.id },
      },
      select: { candidateId: true },
    });
    for (const a of apps) revealedIds.add(a.candidateId);
  }

  return (
    <>
      <PageHeader title={offer.title} description={t("offerDetail.header.slotCount", { sector: offer.sector, location: offer.location, n: offer.slots })}>
        <span
          className={
            "rounded-full px-2 py-0.5 mg-caption font-medium " +
            (offer.status === "ACTIVE"
              ? "bg-success/15 text-success"
              : offer.status === "DRAFT"
                ? "bg-muted text-muted-foreground"
                : "bg-secondary text-secondary-foreground")
          }
        >
          {offer.status}
        </span>
      </PageHeader>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("offerDetail.details.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 mg-body-sm">
            <p className="whitespace-pre-wrap">{offer.description}</p>
            <div>
              <span className="font-medium">{t("offerDetail.details.requirementsLabel")} </span>
              {offer.requirements.length ? offer.requirements.join(", ") : <span className="text-muted-foreground">{tc("none")}</span>}
            </div>
            <div>
              <span className="font-medium">{t("offerDetail.details.languagesLabel")} </span>
              {offer.langRequired.length ? offer.langRequired.join(", ") : <span className="text-muted-foreground">{tc("none")}</span>}
            </div>
            <div className="mg-caption text-muted-foreground">
              {t("offerDetail.details.applicationCount", { n: offer._count.applications })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("offerDetail.shortlist.title")}</CardTitle>
                <CardDescription>{t("offerDetail.shortlist.description")}</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/enterprise/candidates">{t("offerDetail.shortlist.browseAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="mg-body-sm text-muted-foreground">
                {t("offerDetail.shortlist.empty")}
              </p>
            ) : (
              <ul className="divide-y">
                {top.map((m) => {
                  const c = byId.get(m.candidateId);
                  if (!c) return null;
                  const revealed = revealedIds.has(c.id);
                  const displayName = revealed
                    ? `${c.firstName} ${c.lastName}`
                    : maskName(c.firstName, c.lastName);
                  return (
                    <li key={m.candidateId} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            <Link
                              href={`/enterprise/candidates/${c.id}`}
                              className={revealed ? "hover:underline" : "font-mono hover:underline"}
                            >
                              {displayName}
                            </Link>
                            {!revealed ? (
                              <span className="ml-2 mg-caption font-normal text-muted-foreground">
                                {t("offerDetail.candidate.masked")}
                              </span>
                            ) : null}
                            {c.city ? <span className="text-muted-foreground"> — {c.city}</span> : null}
                          </div>
                          <div className="mg-caption text-muted-foreground">
                            {c.skills.slice(0, 6).join(", ") || t("offerDetail.candidate.noSkills")}
                            {c.sectors.length ? ` · ${c.sectors.slice(0, 3).join(", ")}` : ""}
                          </div>
                          <div className="mg-caption text-muted-foreground flex flex-wrap items-center gap-1.5">
                            <span>
                              {t("offerDetail.candidate.langScorePrefix.fr")} {c.langScoreFR ?? "—"} · {t("offerDetail.candidate.langScorePrefix.en")} {c.langScoreEN ?? "—"}
                            </span>
                            {c.langScoreFRVerifiedAt ? (
                              <Badge tone="success" icon="check-circle-2">
                                {tl("badge.frVerifiedShort")}
                              </Badge>
                            ) : null}
                            {c.langScoreENVerifiedAt ? (
                              <Badge tone="success" icon="check-circle-2">
                                {tl("badge.enVerifiedShort")}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold">{m.score}</div>
                          <div className="mg-caption uppercase tracking-wide text-muted-foreground">{t("offerDetail.candidate.matchLabel")}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 mg-caption text-muted-foreground md:grid-cols-3">
                        {Object.entries(m.breakdown).map(([k, v]) => (
                          <div key={k}>
                            <span className="font-medium text-foreground">{tc(`criterion.${k}`)}:</span>{" "}
                            {Number(v).toFixed(1)}
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
