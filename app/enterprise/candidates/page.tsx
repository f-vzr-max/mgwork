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

const QUICK_SECTORS = ["Hôtellerie", "Cuisine", "Construction", "Santé", "Logistique"];

export default async function BrowseCandidatesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, enterprise: { select: { id: true } } },
  });
  if (!user) redirect("/onboarding");
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin && user.role !== "ENTERPRISE") {
    return (
      <PageHeader title="Accès refusé" subtitle="Un compte Entreprise est requis." />
    );
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
    <>
      <PageHeader
        title="Candidats"
        subtitle="Filtrez par secteur, langue ou compétences. Identités masquées avant présélection."
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={20}>
          <form method="get" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Stack dir="row" gap={8} wrap>
              {QUICK_SECTORS.map((s) => {
                const active = sector === s;
                return (
                  <Link
                    key={s}
                    href={buildHref({ sector: active ? "" : s, lang, skills: skillsCsv })}
                    style={{ textDecoration: "none" }}
                  >
                    <Badge tone={active ? "primary" : "neutral"} size="md">
                      {s}
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
              <Input name="sector" defaultValue={sector} placeholder="Secteur" />
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
                <option value="">Langue ≥ 60</option>
                <option value="FR">FR</option>
                <option value="EN">EN</option>
              </select>
              <Input
                name="skills"
                defaultValue={skillsCsv}
                placeholder="Compétences (séparées par virgules)"
              />
              <Stack dir="row" gap={8}>
                <Button type="submit" iconLeft="filter">
                  Appliquer
                </Button>
                <Link href="/enterprise/candidates" style={{ textDecoration: "none" }}>
                  <Button type="button" variant="outline">
                    Réinitialiser
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
              {page.length} candidat{page.length > 1 ? "s" : ""}
              {hasMore ? " (page partielle)" : ""}
            </h3>
            <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
              PII masqué · règle Plan Business
            </span>
          </div>
          <Hairline />
          {page.length === 0 ? (
            <div
              className="mg-body-sm"
              style={{ padding: "24px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              Aucun candidat ne correspond à ces filtres.
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
                          FR {c.langScoreFR ?? "—"} · EN {c.langScoreEN ?? "—"} · Profil{" "}
                          {c.profileScore}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <ScoreGauge value={c.profileScore} size={44} stroke={4} label={false} />
                      <Stack dir="row" gap={6}>
                        <Button variant="ghost" size="sm">
                          Passer
                        </Button>
                        <Button size="sm">Présélectionner</Button>
                      </Stack>
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
                    Suivant
                  </Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
