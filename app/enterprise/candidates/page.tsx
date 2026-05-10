// MG Work — Browse candidates (M5).
//
// Server component. Filters via URL search params:
//   ?sector=Construction
//   ?lang=FR  (uppercase code; filter is "lang score >= 60")
//   ?skills=welding,forklift  (comma-separated; matches any)
//   ?cursor=<candidateId>  (cursor pagination over Candidate.id)
// Pagination: 20 per page. We don't currently expose `total`; cursor + "Next"
// is enough for the skeleton.
//
// Auth: ENTERPRISE | ADMIN | SUPER_ADMIN.

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <>
        <PageHeader title="Forbidden" description="Enterprise account required." />
      </>
    );
  }

  const sector = (searchParams.sector ?? "").trim();
  const lang = (searchParams.lang ?? "").toUpperCase();
  const skillsCsv = (searchParams.skills ?? "").trim();
  const skills = skillsCsv.length
    ? skillsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
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
      <PageHeader title="Candidates" description="Browse the talent pool. Filter by sector, language, and skills." />
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Server-side. Resets cursor on submit.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4" method="get">
              <input
                name="sector"
                defaultValue={sector}
                placeholder="Sector"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <select
                name="lang"
                defaultValue={lang}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Language ≥ 60</option>
                <option value="FR">FR</option>
                <option value="EN">EN</option>
              </select>
              <input
                name="skills"
                defaultValue={skillsCsv}
                placeholder="Skills (comma-separated)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
              />
              <div className="md:col-span-4 flex gap-2">
                <Button type="submit">Apply filters</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/enterprise/candidates">Reset</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {page.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates match these filters.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {page.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {c.firstName} {c.lastName}
                      {c.city ? <span className="text-muted-foreground"> — {c.city}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.skills.slice(0, 8).join(", ") || "no skills listed"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.sectors.slice(0, 4).join(", ") || "no sectors"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>FR: {c.langScoreFR ?? "—"}</div>
                    <div>EN: {c.langScoreEN ?? "—"}</div>
                    <div>Profile: {c.profileScore}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={buildHref({ sector, lang, skills: skillsCsv, cursor: nextCursor })}>Next</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
