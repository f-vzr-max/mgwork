// MG Work — Candidate matches (M5).
//
// Server component. Resolves the signed-in candidate, calls
// `findOffersForCandidate`, and renders ranked offers.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findOffersForCandidate } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CRITERION_LABELS: Record<string, string> = {
  skills: "Skills",
  languages: "Languages",
  sector: "Sector",
  mobility: "Mobility",
  experience: "Experience",
  documents: "Documents",
};

export default async function CandidateMatchesPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      candidate: { select: { id: true } },
    },
  });
  if (!user) redirect("/onboarding");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <>
        <PageHeader title="Matches" description="Candidate account required." />
      </>
    );
  }

  const weights = await getMatchingWeights();
  const ranked = await findOffersForCandidate(user.candidate.id, weights, 20);

  // Hydrate offer rows for display.
  const offerIds = ranked.map((m) => m.offerId);
  const offers = offerIds.length
    ? await prisma.jobOffer.findMany({
        where: { id: { in: offerIds } },
        select: {
          id: true,
          title: true,
          sector: true,
          location: true,
          slots: true,
          status: true,
          enterprise: { select: { companyName: true } },
        },
      })
    : [];
  const byId = new Map(offers.map((o) => [o.id, o]));

  return (
    <>
      <PageHeader
        title="Your matches"
        description="Offers ranked for you using the latest matching weights."
      />
      <div className="p-6 space-y-4">
        {ranked.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No active offers yet</CardTitle>
              <CardDescription>
                Once enterprises publish offers that match your profile, they will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {ranked.map((m) => {
              const o = byId.get(m.offerId);
              if (!o) return null;
              return (
                <li key={m.offerId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        <Link href={`/candidate/jobs/${o.id}`} className="hover:underline">
                          {o.title}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.enterprise.companyName} · {o.sector} · {o.location} · {o.slots} slot
                        {o.slots === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold">{m.score}</div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">match</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-3">
                    {Object.entries(m.breakdown).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium text-foreground">{CRITERION_LABELS[k] ?? k}:</span>{" "}
                        {Number(v).toFixed(1)}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
