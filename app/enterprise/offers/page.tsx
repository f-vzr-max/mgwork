// MG Work — Enterprise offers list.
//
// Server component. Lists the signed-in enterprise's job offers + the
// freemium quota in the MG style. The "Nouvelle offre" CTA is gated on the
// quota; when exhausted we surface an upgrade prompt rather than dead-end.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOfferQuota } from "@/lib/billing";
import {
  Badge,
  Button,
  Card,
  Hairline,
  PageHeader,
  Progress,
  Stack,
  StatusBadge,
} from "@/components/mg";

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
        <PageHeader
          title="Offres"
          subtitle="Publiez et suivez vos postes ouverts."
        />
        <div style={{ padding: "0 32px 32px" }}>
          <Card padding={24}>
            <Stack gap={12}>
              <h3 className="mg-h3" style={{ margin: 0 }}>
                Complétez votre profil entreprise
              </h3>
              <p
                className="mg-body-sm"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                Un profil société est requis avant de publier des offres.
              </p>
              <div>
                <Link href="/onboarding" style={{ textDecoration: "none" }}>
                  <Button iconRight="arrow-right">Terminer l&apos;onboarding</Button>
                </Link>
              </div>
            </Stack>
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
  const usagePct = quota?.limit ? Math.round((quota.active / quota.limit) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Offres"
        subtitle={`Publiées pour ${user.enterprise.companyName}.`}
        action={
          canCreate ? (
            <Link href="/enterprise/offers/new" style={{ textDecoration: "none" }}>
              <Button iconLeft="plus">Nouvelle offre</Button>
            </Link>
          ) : (
            <Button
              iconLeft="plus"
              disabled
              title="Quota atteint. Mettez à niveau ou mettez en pause une offre existante."
            >
              Nouvelle offre
            </Button>
          )
        }
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {quota ? (
          <Card padding={20}>
            <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 4 }}>
              <span className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
                Plan {quota.plan}
              </span>
              {canCreate ? (
                <Badge tone="success" icon="check-circle-2">
                  Quota OK
                </Badge>
              ) : (
                <Badge tone="warning" icon="alert-triangle">
                  Quota atteint
                </Badge>
              )}
            </Stack>
            <div className="mg-h2" style={{ margin: "8px 0 0" }}>
              {quota.active} / {quota.limit ?? "∞"}
            </div>
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
            >
              offres actives
              {quota.limit != null
                ? ` · ${quota.remaining ?? 0} restantes`
                : " · illimité"}
            </div>
            {quota.limit != null && <Progress value={usagePct} />}
            {!canCreate && (
              <p
                className="mg-body-sm"
                style={{ marginTop: 12, color: "hsl(var(--muted-foreground))" }}
              >
                Le plan gratuit limite les offres actives. Mettez en pause une offre existante ou
                passez au plan STARTER / PRO.
              </p>
            )}
          </Card>
        ) : null}

        {offers.length === 0 ? (
          <Card padding={24}>
            <Stack gap={12}>
              <h3 className="mg-h3" style={{ margin: 0 }}>
                Aucune offre pour l&apos;instant
              </h3>
              <p
                className="mg-body-sm"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                Publiez votre première offre pour commencer à recevoir une présélection IA.
              </p>
              {canCreate ? (
                <div>
                  <Link href="/enterprise/offers/new" style={{ textDecoration: "none" }}>
                    <Button iconLeft="plus">Créer la première offre</Button>
                  </Link>
                </div>
              ) : null}
            </Stack>
          </Card>
        ) : (
          <Card padding={0}>
            <div style={{ padding: "14px 20px" }}>
              <h3 className="mg-h4" style={{ margin: 0 }}>
                Vos offres
              </h3>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
              >
                {offers.length} offre{offers.length > 1 ? "s" : ""} au total
              </div>
            </div>
            <Hairline />
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {offers.map((o, i) => (
                <li
                  key={o.id}
                  style={{
                    padding: "14px 20px",
                    borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                  }}
                >
                  <Link
                    href={`/enterprise/offers/${o.id}`}
                    style={{
                      textDecoration: "none",
                      color: "hsl(var(--foreground))",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Stack dir="row" gap={8} align="center" wrap>
                        <span className="mg-body-sm" style={{ fontWeight: 600 }}>
                          {o.title}
                        </span>
                        <StatusBadge status={o.status} />
                      </Stack>
                      <div
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}
                      >
                        {o.sector} · {o.location} · {o.slots} poste{o.slots === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Stack dir="row" gap={6} align="center">
                      <Badge tone="info">{o._count.applications} candidat{o._count.applications === 1 ? "" : "s"}</Badge>
                      <Badge tone="primary">
                        {o._count.matchings} présélection{o._count.matchings === 1 ? "" : "s"}
                      </Badge>
                    </Stack>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
