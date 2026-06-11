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
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("app.candidate.dashboard");
  const tc = await getTranslations("common");
  const tl = await getTranslations("langTest");

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
          langScoreFRVerifiedAt: true,
          langScoreENVerifiedAt: true,
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
          <div className="mg-h3" style={{ margin: 0 }}>{t("noProfile.title")}</div>
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {t("noProfile.body")}
          </div>
          <Link href="/onboarding" style={{ textDecoration: "none" }}>
            <Button style={{ marginTop: 12 }} iconRight="arrow-right">{t("noProfile.cta")}</Button>
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
  if (!c.dateOfBirth) missing.push(t("profile.missingDob"));
  if (c.langScoreFR == null && c.langScoreEN == null) missing.push(t("profile.missingLanguages"));
  if (!c.city) missing.push(t("profile.missingCity"));
  const missingPreview = missing.slice(0, 3).join(" · ") || t("profile.missingAvailability");

  // "Fresh" = match surfaced in the last 7 days. The matching layer doesn't
  // persist a createdAt, so we fall back to the offer.createdAt.
  const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;
  const now = Date.now();

  // Language verification state. A score without its VerifiedAt stamp is the
  // onboarding self-assessment; the AI test (/candidate/language-test) is what
  // stamps it verified.
  const frVerified = c.langScoreFRVerifiedAt != null;
  const enVerified = c.langScoreENVerifiedAt != null;
  const bothVerified = frVerified && enVerified;

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
              {t("profile.completedLabel")}
            </div>
            <div className="mg-h3" style={{ margin: "4px 0 0" }}>
              {c.profileScore >= 100
                ? t("profile.ready")
                : t("profile.stepsRemaining", { n: Math.max(1, missing.length || 1) })}
            </div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
              {missingPreview}
            </div>
          </div>
        </Stack>
        {c.profileScore < 100 && (
          <Link href="/onboarding" style={{ textDecoration: "none", display: "block", marginTop: 16 }}>
            <Button size="lg" fullWidth iconRight="arrow-right">
              {t("profile.finishCta")}
            </Button>
          </Link>
        )}
      </Card>

      {/* Language verification card ------------------------------------- */}
      <Card padding={16}>
        <Stack dir="row" gap={12} align="center">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              background: bothVerified ? "var(--success-bg)" : "var(--primary-bg)",
              color: bothVerified ? "hsl(var(--success))" : "hsl(var(--primary))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={bothVerified ? "check-circle-2" : "globe"} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mg-body-sm" style={{ fontWeight: 600 }}>
              {bothVerified ? tl("dashboard.verifiedTitle") : tl("dashboard.title")}
            </div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
              {bothVerified ? tl("dashboard.verifiedBody") : tl("dashboard.body")}
            </div>
          </div>
        </Stack>
        <Stack dir="row" gap={6} wrap style={{ marginTop: 10 }}>
          {frVerified ? (
            <Badge tone="success" icon="check-circle-2">
              {tl("badge.fr", { score: c.langScoreFR ?? 0 })}
            </Badge>
          ) : c.langScoreFR != null ? (
            <Badge tone="neutral">{tl("badge.frSelf", { score: c.langScoreFR })}</Badge>
          ) : (
            <Badge tone="neutral">{tl("badge.frNone")}</Badge>
          )}
          {enVerified ? (
            <Badge tone="success" icon="check-circle-2">
              {tl("badge.en", { score: c.langScoreEN ?? 0 })}
            </Badge>
          ) : c.langScoreEN != null ? (
            <Badge tone="neutral">{tl("badge.enSelf", { score: c.langScoreEN })}</Badge>
          ) : (
            <Badge tone="neutral">{tl("badge.enNone")}</Badge>
          )}
        </Stack>
        <Link
          href="/candidate/language-test"
          style={{ textDecoration: "none", display: "block", marginTop: 12 }}
        >
          <Button size="sm" variant={bothVerified ? "outline" : "default"} iconRight="arrow-right">
            {bothVerified ? tl("dashboard.retakeCta") : tl("dashboard.cta")}
          </Button>
        </Link>
      </Card>

      {/* Documents strip ------------------------------------------------ */}
      <div>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <h3 className="mg-h4" style={{ margin: 0 }}>{t("documents.title")}</h3>
          <Link
            href="/candidate/documents"
            style={{
              color: "hsl(var(--primary))",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("documents.viewAll")}
          </Link>
        </Stack>
        {docs.length === 0 ? (
          <Card padding={14}>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("documents.empty")}
            </div>
            <Link href="/candidate/documents" style={{ textDecoration: "none", display: "inline-block", marginTop: 10 }}>
              <Button size="sm" variant="outline" iconLeft="upload">{t("documents.addCta")}</Button>
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
                  {tc(`docType.${d.type}`)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Matches feed --------------------------------------------------- */}
      <div>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <h3 className="mg-h4" style={{ margin: 0 }}>{t("matches.title")}</h3>
          <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("matches.thisWeek", { n: topMatches.length })}
          </span>
        </Stack>
        {topMatches.length === 0 ? (
          <Card padding={14}>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("matches.empty")}
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
                            {t("matches.newBadge")}
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
            <div className="mg-body-sm" style={{ fontWeight: 600 }}>{t("chat.question")}</div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("chat.responseTime")}
            </div>
          </div>
          <Link href="/candidate/chat" style={{ textDecoration: "none" }}>
            <Button variant="outline" size="sm" iconRight="arrow-right">{t("chat.writeCta")}</Button>
          </Link>
        </Stack>
      </Card>
    </div>
  );
}
