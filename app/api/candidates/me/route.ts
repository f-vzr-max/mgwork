// /api/candidates/me
//
//   GET   — signed-in CANDIDATE → returns the caller's OWN candidate row.
//   PATCH — signed-in CANDIDATE → updates the caller's OWN text/preference
//           fields. avatarUrl is NEVER writable here (it is owned exclusively
//           by /api/candidates/me/avatar); cvFileUrl / profileScore / lang
//           scores are server-managed and likewise rejected by the strict
//           schema in lib/validation/candidate.ts.
//
// Auth: the candidate id is resolved from the Clerk session → User row →
// Candidate row. A client-supplied id is never trusted. Mirrors the auth /
// CSRF / rate-limit / audit shape of app/api/candidates/route.ts.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { candidateSelfUpdateSchema } from "@/lib/validation/candidate";
import { err, ok } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

// Public projection of a candidate's own row. Never leaks another candidate's
// data — the route only ever loads the caller's row. `avatarUrl` is returned
// as a boolean presence flag; the actual image is served as a short-lived
// signed URL by GET /api/candidates/me/avatar.
export type CandidateSelfDto = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string;
  phone: string | null;
  city: string | null;
  bio: string | null;
  skills: string[];
  sectors: string[];
  langScoreFR: number | null;
  langScoreEN: number | null;
  // ISO timestamps set by /api/ai/lang-test when the AI grades the level;
  // null = the score (if any) is the onboarding self-assessment.
  langScoreFRVerifiedAt: string | null;
  langScoreENVerifiedAt: string | null;
  profileScore: number;
  hasAvatar: boolean;
  hasCv: boolean;
};

type SelfRow = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  nationality: string;
  phone: string | null;
  city: string | null;
  bio: string | null;
  skills: string[];
  sectors: string[];
  langScoreFR: number | null;
  langScoreEN: number | null;
  langScoreFRVerifiedAt: Date | null;
  langScoreENVerifiedAt: Date | null;
  profileScore: number;
  avatarUrl: string | null;
  cvFileUrl: string | null;
};

const SELF_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  nationality: true,
  phone: true,
  city: true,
  bio: true,
  skills: true,
  sectors: true,
  langScoreFR: true,
  langScoreEN: true,
  langScoreFRVerifiedAt: true,
  langScoreENVerifiedAt: true,
  profileScore: true,
  avatarUrl: true,
  cvFileUrl: true,
} as const;

function toSelfDto(row: SelfRow): CandidateSelfDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : null,
    nationality: row.nationality,
    phone: row.phone,
    city: row.city,
    bio: row.bio,
    skills: row.skills,
    sectors: row.sectors,
    langScoreFR: row.langScoreFR,
    langScoreEN: row.langScoreEN,
    langScoreFRVerifiedAt: row.langScoreFRVerifiedAt ? row.langScoreFRVerifiedAt.toISOString() : null,
    langScoreENVerifiedAt: row.langScoreENVerifiedAt ? row.langScoreENVerifiedAt.toISOString() : null,
    profileScore: row.profileScore,
    hasAvatar: !!row.avatarUrl,
    hasCv: !!row.cvFileUrl,
  };
}

// Resolve the caller's own Candidate row id from the session. Returns a typed
// error response on any failure so callers can early-return it.
async function resolveOwnCandidate(
  clerkId: string,
): Promise<
  | { ok: true; candidateId: string; userId: string }
  | { ok: false; res: NextResponse }
> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, candidate: { select: { id: true } } },
  });
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        err("NOT_FOUND", "User profile not yet synced; retry shortly"),
        { status: 404 },
      ),
    };
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return {
      ok: false,
      res: NextResponse.json(
        err("FORBIDDEN", "Only candidates can access this resource"),
        { status: 403 },
      ),
    };
  }
  return { ok: true, candidateId: user.candidate.id, userId: user.id };
}

// ---------- GET (caller's own profile) ----------

export async function GET(): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "candidate.me.get", 60, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  const row = await prisma.candidate.findUnique({
    where: { id: resolved.candidateId },
    select: SELF_SELECT,
  });
  if (!row) {
    return NextResponse.json(err("NOT_FOUND", "Candidate not found"), {
      status: 404,
    });
  }

  return NextResponse.json(ok({ candidate: toSelfDto(row) }));
}

// ---------- PATCH (update own text/preference fields) ----------

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "candidate.me.update", 20, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), {
      status: 400,
    });
  }

  let parsed;
  try {
    parsed = candidateSelfUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid profile payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  // Build the update from only the keys the caller actually sent (PATCH
  // semantics). `parsed` already excludes avatarUrl/cvFileUrl/scores via the
  // strict schema, so there is no field-allowlist to re-derive here — every
  // key present on `parsed` is safe to write.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    data[key] = value;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "No updatable fields provided"),
      { status: 400 },
    );
  }

  const updated = await prisma.candidate.update({
    where: { id: resolved.candidateId },
    data,
    select: SELF_SELECT,
  });

  await logAudit({
    userId: resolved.userId,
    action: "candidate.update",
    resourceType: "candidate",
    resourceId: resolved.candidateId,
    ipAddress: getIp(req),
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json(ok({ candidate: toSelfDto(updated) }));
}
