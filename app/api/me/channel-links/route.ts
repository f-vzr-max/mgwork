// /api/me/channel-links — connect WhatsApp/Messenger/Instagram to the
// caller's own Candidate account (channels phase 0).
//
//   GET    — signed-in CANDIDATE → list the caller's linked channel
//            identities (for the profile "Connected channels" card).
//   POST   — issue an 8-char one-time ChannelLinkToken (15-min expiry) and
//            return wa.me / m.me deep links when the business number / page
//            id are configured (null otherwise — the UI shows just the code).
//   DELETE — unlink one of the caller's channel identities.
//
// Auth: the candidate id is resolved from the Clerk session → User row →
// Candidate row. A client-supplied id is never trusted; DELETE additionally
// checks the identity belongs to the caller. Mirrors the auth / CSRF /
// rate-limit / audit shape of app/api/candidates/me/route.ts.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { issueLinkToken, unlinkChannelIdentity } from "@/lib/social/identity";
import { err, ok } from "@/types/api";

// Route-local body schemas (validate input at the boundary). Token issuing
// may optionally pin the token to one platform; TIKTOK stays descoped.
const issueSchema = z
  .object({
    platform: z.enum(["WHATSAPP", "MESSENGER", "INSTAGRAM"]).optional(),
  })
  .strict();

const unlinkSchema = z
  .object({
    channelIdentityId: z.string().min(1).max(64),
  })
  .strict();

export type ChannelLinkDto = {
  id: string;
  platform: string;
  status: string;
  linkedVia: string | null;
  linkedAt: string; // ISO — last status change (updatedAt)
};

// Resolve the caller's own Candidate row id from the session. Returns a typed
// error response on any failure so callers can early-return it.
async function resolveOwnCandidate(
  clerkId: string,
): Promise<{ ok: true; candidateId: string; userId: string } | { ok: false; res: NextResponse }> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, candidate: { select: { id: true } } },
  });
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(err("NOT_FOUND", "User profile not yet synced; retry shortly"), {
        status: 404,
      }),
    };
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return {
      ok: false,
      res: NextResponse.json(err("FORBIDDEN", "Only candidates can access this resource"), {
        status: 403,
      }),
    };
  }
  return { ok: true, candidateId: user.candidate.id, userId: user.id };
}

function csrfGuard(req: Request): NextResponse | null {
  try {
    assertSameOrigin(req);
    return null;
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }
}

// ---------- GET (list own linked channels) ----------

export async function GET(): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "channel_links.get", 60, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  const rows = await prisma.channelIdentity.findMany({
    where: { candidateId: resolved.candidateId },
    select: { id: true, platform: true, status: true, linkedVia: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const channels: ChannelLinkDto[] = rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    status: r.status,
    linkedVia: r.linkedVia,
    linkedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json(ok({ channels }));
}

// ---------- POST (issue a one-time link code + deep links) ----------

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  // Codes are cheap but one-time — cap issuing tighter than reads.
  const allowed = await rateLimit(clerkId, "channel_links.issue", 10, 600);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  // Body is optional ({} when absent) — platform pinning is opt-in.
  const body = await req.json().catch(() => ({}));
  const parsed = issueSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(err("VALIDATION_ERROR", "Invalid body"), { status: 400 });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  const { code, expiresAt } = await issueLinkToken(resolved.candidateId, parsed.data.platform);

  await logAuditByClerkId(clerkId, {
    action: "channel_link.token_issued",
    resourceType: "channel_link",
    resourceId: code,
  });

  // Deep links: only when the human-gated env is configured; the card falls
  // back to showing the bare code. The wa.me text pre-fills "LINK <code>";
  // the m.me ref carries the code as a Messenger referral.
  const waNumber = env.whatsappBusinessNumber()?.replace(/[^0-9]/g, "");
  const pageId = env.metaPageId();
  const links = {
    whatsapp: waNumber
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`LINK ${code}`)}`
      : null,
    messenger: pageId ? `https://m.me/${encodeURIComponent(pageId)}?ref=${code}` : null,
  };

  return NextResponse.json(ok({ code, expiresAt: expiresAt.toISOString(), links }));
}

// ---------- DELETE (unlink one of the caller's channels) ----------

export async function DELETE(req: Request): Promise<NextResponse> {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "channel_links.unlink", 20, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = unlinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(err("VALIDATION_ERROR", "Invalid body"), { status: 400 });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  // Ownership check: the identity must currently be linked to the caller.
  const identity = await prisma.channelIdentity.findUnique({
    where: { id: parsed.data.channelIdentityId },
    select: { id: true, candidateId: true },
  });
  if (!identity || identity.candidateId !== resolved.candidateId) {
    return NextResponse.json(err("NOT_FOUND", "Channel link not found"), { status: 404 });
  }

  // unlinkChannelIdentity audit-logs `channel.unlink` against the candidate.
  await unlinkChannelIdentity(identity.id);

  return NextResponse.json(ok({ unlinked: true }));
}
