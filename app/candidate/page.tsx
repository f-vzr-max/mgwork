// MG Work — Candidate dashboard.
//
// Server component. Resolves the signed-in user from Clerk, loads the
// candidate profile + a handful of recent documents + the top matches, and
// renders the mobile-first artboard (greeting, profile gauge, document
// strip, matches feed, chat CTA). The layout handles the responsive
// 2-column shell; this page is just the content column.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOffersForCandidate } from "@/lib/matching";
import { getMatchingWeights } from "@/lib/matching-config";
import { isExpired, isExpiringWithin } from "@/lib/dates";
import {
  Badge,
  Button,
  Card,
  Icon,
  ScoreGauge,
  Stack,
  StatusBadge,
  type IconName,
} from "@/components/mg";

export const dynamic = "force-dynamic";

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  PASSPORT: "Passeport",
  MEDICAL_AUTHORIZATION: "Visite méd.",
  WORK_PERMIT: "Permis",
  VISA: "Visa",
  INCORPORATION_CERTIFICATE: "Incorporation",
  OTHER: "Autre",
};

const DOC_TYPE_ICON: Record<DocumentType, IconName> = {
  PASSPORT: "book-user",
  MEDICAL_AUTHORIZATION: "stethoscope",
  WORK_PERMIT: "stamp",
  VISA: "stamp",
  INCORPORATION_CERTIFICATE: "building-2",
  OTHER: "file-text",
};

// Derive the visual status for a document strip tile. The DB has a status
// column, but we surface the soonest signal that matters to the candidate
// (an APPROVED-but-expiring doc still needs attention).
function tileStatus(doc: { status: DocumentStatus; expiresAt: Date | null }): string {
  if (doc.expiresAt && isExpired(doc.expiresAt)) return "EXPIRED";
  if (doc.status === "APPROVED" && doc.expiresAt && isExpiringWithin(doc.expiresAt, 30)) {
    return "EXPIRING_SOON";
  }
  return doc.status;
}

export default async function CandidateDashboard() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          profileScore: true,
          langScoreFR: true,
          langScoreEN: true,
          dateOfBirth: true,
          city: true,
        },
      },
    },
  });
  if (!user) redirect("/onboarding");
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return (
      <div style={{ padding: 16 }}>
        <Card padding={16}>
          <div className="mg-h3" style={{ margin: 0 }}>Profil candidat requis</div>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            Terminez votre onboarding pour accéder au tableau de bord.
          </div>
          <Link href="/onboarding" style={{ textDecoration: "none" }}>
            <Button style={{ marginTop: 12 }} iconRight="arrow-right">Continuer</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const c = user.candidate;

  const [docs, weights] = await Promise.all([
    prisma.document.findMany({
      where: { candidateId: c.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, type: true, status: true, expiresAt: true },
    }),
    getMatchingWeights(),
  ]);

  const topMatches = await findOffersForCandidate(c.id, weights, 3);
  const offers = topMatches.length
    ? await prisma.jobOffer.findMany({
        where: { id: { in: topMatches.map((m) => m.offerId) } },
        select: {
          id: true,
          title: true,
          location: true,
          createdAt: true,
          enterprise: { select: { companyName: true } },
        },
      })
    : [];
  const offersById = new Map(offers.map((o) => [o.id, o]));

  // Find what's missing from the profile to surface the right CTA hint.
  const missing: string[] = [];
  if (!c.dateOfBirth) missing.push("Date de naissance");
  if (c.langScoreFR == null && c.langScoreEN == null) missing.push("Langues");
  if (!c.city) missing.push("Ville");
  const missingPreview = missing.slice(0, 3).join(" · ") || "Disponibilités";

  // "Fresh" = match surfaced in the last 7 days. The matching layer doesn't
  // persist a createdAt, so we fall back to the offer.createdAt.
  const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;
  const now = Date.now();

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Greeting ------------------------------------------------------- */}
      <div>
        <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
          Manao ahoana,
        </div>
        <h1 className="mg-h1" style={{ margin: "2px 0 0", fontSize: 26, lineHeight: "32px" }}>
          {c.firstName}.
        </h1>
      </div>

      {/* Profile gauge card -------------------------------------------- */}
      <Card padding={20}>
        <Stack dir="row" gap={20} align="center">
          <ScoreGauge value={c.profileScore} size={88} stroke={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
              Profil complété
            </div>
            <div className="mg-h3" style={{ margin: "4px 0 0" }}>
              {c.profileScore >= 100
                ? "Profil prêt à postuler"
                : `Encore ${Math.max(1, missing.length || 1)} étape${(missing.length || 1) > 1 ? "s" : ""} pour postuler`}
            </div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
              {missingPreview}
            </div>
          </div>
        </Stack>
        {c.profileScore < 100 && (
          <Link href="/onboarding" style={{ textDecoration: "none", display: "block", marginTop: 16 }}>
            <Button size="lg" fullWidth iconRight="arrow-right">
              Finir mon profil
            </Button>
          </Link>
        )}
      </Card>

      {/* Documents strip ------------------------------------------------ */}
      <div>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <h3 className="mg-h4" style={{ margin: 0 }}>Mes documents</h3>
          <Link
            href="/candidate/documents"
            style={{
              color: "hsl(var(--primary))",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Tout voir
          </Link>
        </Stack>
        {docs.length === 0 ? (
          <Card padding={14}>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Aucun document pour l&apos;instant. Commencez par ajouter votre passeport.
            </div>
            <Link href="/candidate/documents" style={{ textDecoration: "none", display: "inline-block", marginTop: 10 }}>
              <Button size="sm" variant="outline" iconLeft="upload">Ajouter</Button>
            </Link>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {docs.map((d) => (
              <Card
                key={d.id}
                padding={12}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <Stack dir="row" justify="space-between" align="center">
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
                    <Icon name={DOC_TYPE_ICON[d.type]} size={14} />
                  </div>
                  <StatusBadge status={tileStatus(d)} />
                </Stack>
                <div className="mg-body-sm" style={{ fontWeight: 600 }}>
                  {DOC_TYPE_LABEL[d.type]}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Matches feed --------------------------------------------------- */}
      <div>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <h3 className="mg-h4" style={{ margin: 0 }}>Nouveaux matchs</h3>
          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {topMatches.length} cette semaine
          </span>
        </Stack>
        {topMatches.length === 0 ? (
          <Card padding={14}>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Aucun match pour le moment. Complétez votre profil pour augmenter vos chances.
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topMatches.map((m) => {
              const o = offersById.get(m.offerId);
              if (!o) return null;
              const fresh = now - o.createdAt.getTime() < SEVEN_DAYS;
              return (
                <Link key={m.offerId} href={`/candidate/matches`} style={{ textDecoration: "none", color: "inherit" }}>
                  <Card padding={14} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <ScoreGauge value={m.score} size={48} stroke={4} label={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Stack dir="row" gap={6} align="center" wrap>
                        <span className="mg-body-sm" style={{ fontWeight: 600 }}>{o.title}</span>
                        {fresh && (
                          <Badge tone="primary" className="mg-pulse-soft">
                            Nouveau
                          </Badge>
                        )}
                      </Stack>
                      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                        {o.enterprise.companyName} · {o.location}
                      </div>
                    </div>
                    <Icon name="chevron-right" size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat CTA ------------------------------------------------------- */}
      <Card padding={16} surface={2}>
        <Stack dir="row" gap={12} align="center">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              background: "var(--primary-bg)",
              color: "hsl(var(--primary))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="message-circle" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mg-body-sm" style={{ fontWeight: 600 }}>Une question ?</div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
              Un conseiller répond en moyenne en 2h
            </div>
          </div>
          <Link href="/candidate/chat" style={{ textDecoration: "none" }}>
            <Button variant="outline" size="sm" iconRight="arrow-right">Écrire</Button>
          </Link>
        </Stack>
      </Card>
    </div>
  );
}
