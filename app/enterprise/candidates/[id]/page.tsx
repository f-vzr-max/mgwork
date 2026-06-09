// MG Work — Candidate profile (enterprise view) with shortlist-gated PII.
//
// Server component. PII (full name, phone, bio, photo) is revealed ONLY when
// the REQUESTING enterprise has an Application for this candidate, under one of
// its OWN offers, whose status has reached SHORTLISTED or beyond. The gate is a
// DB-level join (Application -> JobOffer.enterpriseId === requester) — never a
// client-supplied flag. Admins always see full PII. Any other enterprise sees
// the masked view (initials + non-identifying signal only).
//
// NOTE (compliance): marketing copy describes reveal as "after shortlist
// acceptance", but the ApplicationStatus enum has no ACCEPTED state, so the
// effective gate is SHORTLISTED (the first post-applied rank). Flagged upstream.

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/supabase";
import { parseStorageRef } from "@/lib/documents";
import {
  Avatar,
  Badge,
  Card,
  Hairline,
  PageHeader,
  ScoreGauge,
  Stack,
} from "@/components/mg";

export const dynamic = "force-dynamic";

// Reveal threshold: SHORTLISTED and every later stage. Listed explicitly so a
// future enum reorder can't silently widen the gate. APPLIED / REJECTED stay
// masked (REJECTED is a terminal "no", not a reveal-worthy relationship).
const REVEAL_STATUSES: ApplicationStatus[] = [
  "SHORTLISTED",
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

export default async function CandidateProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.enterprise");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) redirect("/onboarding");

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin && user.role !== "ENTERPRISE") {
    return (
      <PageHeader
        title={t("candidates.accessDenied")}
        subtitle={t("candidates.accessDeniedSubtitle")}
      />
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: true,
      phone: true,
      bio: true,
      avatarUrl: true,
      profileScore: true,
      langScoreFR: true,
      langScoreEN: true,
      skills: true,
      sectors: true,
    },
  });
  if (!candidate) notFound();

  // PII gate — DB-level. Reveal only if the REQUESTING enterprise has an
  // application for this candidate, on one of its own offers, that reached
  // SHORTLISTED+. Admins bypass. The enterprise id is session-derived; we never
  // trust a client-supplied enterprise/candidate relationship.
  let revealed = isAdmin;
  if (!revealed && user.role === "ENTERPRISE" && user.enterprise) {
    const gated = await prisma.application.count({
      where: {
        candidateId: candidate.id,
        status: { in: REVEAL_STATUSES },
        jobOffer: { enterpriseId: user.enterprise.id },
      },
    });
    revealed = gated > 0;
  }

  const displayName = revealed
    ? `${candidate.firstName} ${candidate.lastName}`
    : maskName(candidate.firstName, candidate.lastName);

  // Avatar is PII-equivalent: only sign + render it once revealed. Stored as a
  // `supabase://bucket/path` ref in a private bucket (decision C); fall back to
  // initials if it isn't a recognizable ref or signing fails.
  let avatarSrc: string | undefined;
  if (revealed && candidate.avatarUrl) {
    const ref = parseStorageRef(candidate.avatarUrl);
    if (ref) {
      const signed = await createSignedUrl(ref.bucket, ref.objectPath);
      if (!("error" in signed)) avatarSrc = signed.url;
    }
  }

  const muted = { color: "hsl(var(--muted-foreground))" } as const;

  return (
    <>
      <PageHeader
        title={revealed ? t("candidateProfile.title") : t("candidateProfile.maskedTitle")}
        subtitle={
          revealed
            ? t("candidateProfile.subtitle")
            : t("candidateProfile.maskedNotice")
        }
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar name={displayName} src={avatarSrc} size={64} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Stack dir="row" gap={8} align="center" wrap>
                <span
                  className={revealed ? "mg-h3" : "mg-h3 mg-mono"}
                  style={{ margin: 0 }}
                >
                  {displayName}
                </span>
                {candidate.city && <Badge tone="neutral">{candidate.city}</Badge>}
                {!revealed && (
                  <Badge tone="warning">{t("candidateProfile.maskedBadge")}</Badge>
                )}
              </Stack>
              <div className="mg-caption" style={{ ...muted, marginTop: 4 }}>
                {t("candidates.card.scoreCaption", {
                  fr: candidate.langScoreFR ?? "—",
                  en: candidate.langScoreEN ?? "—",
                  score: candidate.profileScore,
                })}
              </div>
            </div>
            <ScoreGauge value={candidate.profileScore} size={56} stroke={5} />
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: "14px 20px" }}>
            <h3 className="mg-h4" style={{ margin: 0 }}>
              {t("candidateProfile.sections.signal")}
            </h3>
          </div>
          <Hairline />
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="mg-caption" style={{ ...muted, marginBottom: 6 }}>
                {t("candidateProfile.fields.sectors")}
              </div>
              <Stack dir="row" gap={8} wrap>
                {candidate.sectors.length ? (
                  candidate.sectors.map((s) => (
                    <Badge key={s} tone="neutral">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="mg-body-sm" style={muted}>
                    {t("candidateProfile.fields.none")}
                  </span>
                )}
              </Stack>
            </div>
            <div>
              <div className="mg-caption" style={{ ...muted, marginBottom: 6 }}>
                {t("candidateProfile.fields.skills")}
              </div>
              <Stack dir="row" gap={8} wrap>
                {candidate.skills.length ? (
                  candidate.skills.map((s) => (
                    <Badge key={s} tone="info">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="mg-body-sm" style={muted}>
                    {t("candidateProfile.fields.none")}
                  </span>
                )}
              </Stack>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: "14px 20px" }}>
            <h3 className="mg-h4" style={{ margin: 0 }}>
              {t("candidateProfile.sections.contact")}
            </h3>
          </div>
          <Hairline />
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {revealed ? (
              <>
                <div>
                  <div className="mg-caption" style={{ ...muted, marginBottom: 4 }}>
                    {t("candidateProfile.fields.phone")}
                  </div>
                  <span className="mg-body-sm">
                    {candidate.phone || t("candidateProfile.fields.none")}
                  </span>
                </div>
                <div>
                  <div className="mg-caption" style={{ ...muted, marginBottom: 4 }}>
                    {t("candidateProfile.fields.bio")}
                  </div>
                  <p className="mg-body-sm" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {candidate.bio || t("candidateProfile.fields.none")}
                  </p>
                </div>
              </>
            ) : (
              <p className="mg-body-sm" style={{ margin: 0, ...muted }}>
                {t("candidateProfile.lockedContact")}
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
