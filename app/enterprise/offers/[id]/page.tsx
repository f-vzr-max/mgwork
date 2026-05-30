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
import { prisma } from "@/lib/prisma";
import { recomputeMatchings } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise");
  const tc = await getTranslations("common");

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
          skills: true,
          sectors: true,
        },
      })
    : [];
  const byId = new Map(candidates.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title={offer.title} description={t("offerDetail.header.slotCount", { sector: offer.sector, location: offer.location, n: offer.slots })}>
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs font-medium " +
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
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap">{offer.description}</p>
            <div>
              <span className="font-medium">{t("offerDetail.details.requirementsLabel")} </span>
              {offer.requirements.length ? offer.requirements.join(", ") : <span className="text-muted-foreground">{tc("none")}</span>}
            </div>
            <div>
              <span className="font-medium">{t("offerDetail.details.languagesLabel")} </span>
              {offer.langRequired.length ? offer.langRequired.join(", ") : <span className="text-muted-foreground">{tc("none")}</span>}
            </div>
            <div className="text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                {t("offerDetail.shortlist.empty")}
              </p>
            ) : (
              <ul className="divide-y">
                {top.map((m) => {
                  const c = byId.get(m.candidateId);
                  if (!c) return null;
                  return (
                    <li key={m.candidateId} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {c.firstName} {c.lastName}
                            {c.city ? <span className="text-muted-foreground"> — {c.city}</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.skills.slice(0, 6).join(", ") || t("offerDetail.candidate.noSkills")}
                            {c.sectors.length ? ` · ${c.sectors.slice(0, 3).join(", ")}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("offerDetail.candidate.langScorePrefix.fr")} {c.langScoreFR ?? "—"} · {t("offerDetail.candidate.langScorePrefix.en")} {c.langScoreEN ?? "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold">{m.score}</div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("offerDetail.candidate.matchLabel")}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-3">
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
