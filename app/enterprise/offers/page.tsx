// MG Work — Enterprise offers list (M5).
//
// Server component. Lists the signed-in enterprise's job offers and renders
// a "New offer" CTA gated on the freemium quota. When the quota is exhausted
// we render the CTA disabled with an upgrade prompt — clicking shows the
// reason. Visible offers always include their status + counts.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOfferQuota } from "@/lib/billing";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EnterpriseOffersPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      enterprise: { select: { id: true, companyName: true } },
    },
  });
  if (!user) redirect("/onboarding");
  if (!user.enterprise) {
    return (
      <>
        <PageHeader title="Job offers" description="Post and track positions for your placements." />
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete your enterprise profile</CardTitle>
              <CardDescription>You need a company profile before you can post offers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding">Finish onboarding</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const [offers, quota] = await Promise.all([
    prisma.jobOffer.findMany({
      where: { enterpriseId: user.enterprise.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        sector: true,
        location: true,
        slots: true,
        status: true,
        createdAt: true,
        _count: { select: { applications: true, matchings: true } },
      },
    }),
    getOfferQuota(user.enterprise.id),
  ]);

  const canCreate = quota?.canCreate ?? false;
  const upgradeNeeded = !canCreate;

  return (
    <>
      <PageHeader title="Job offers" description={`Listed for ${user.enterprise.companyName}.`}>
        {canCreate ? (
          <Button asChild>
            <Link href="/enterprise/offers/new">New offer</Link>
          </Button>
        ) : (
          <Button disabled title="Free plan caps active offers at 3. Upgrade to add more.">
            New offer
          </Button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {quota ? (
          <Card className={upgradeNeeded ? "border-destructive/40" : undefined}>
            <CardHeader>
              <CardTitle>Plan: {quota.plan}</CardTitle>
              <CardDescription>
                {quota.limit == null
                  ? `${quota.active} active offers (unlimited).`
                  : `${quota.active} of ${quota.limit} active offers used. ${
                      quota.remaining ?? 0
                    } remaining.`}
              </CardDescription>
            </CardHeader>
            {upgradeNeeded ? (
              <CardContent className="text-sm text-muted-foreground">
                Free plan reached. Pause an existing active offer or upgrade to STARTER / PRO to add more.
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {offers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No offers yet</CardTitle>
              <CardDescription>
                Post your first job to start receiving an AI shortlist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canCreate ? (
                <Button asChild>
                  <Link href="/enterprise/offers/new">Create your first offer</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {offers.map((o) => (
              <Card key={o.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        <Link href={`/enterprise/offers/${o.id}`} className="hover:underline">
                          {o.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {o.sector} · {o.location} · {o.slots} slot{o.slots === 1 ? "" : "s"}
                      </CardDescription>
                    </div>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (o.status === "ACTIVE"
                          ? "bg-success/15 text-success"
                          : o.status === "DRAFT"
                            ? "bg-muted text-muted-foreground"
                            : "bg-secondary text-secondary-foreground")
                      }
                    >
                      {o.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {o._count.applications} application{o._count.applications === 1 ? "" : "s"} ·{" "}
                  {o._count.matchings} shortlisted
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
