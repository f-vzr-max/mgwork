// POST /api/locale
//
// Anonymous-friendly locale-cookie endpoint. Drives the public LanguageToggle
// (home + sign-up) without requiring auth — visitors can flip FR/EN before
// signing up. When a Clerk session exists we additionally persist the choice
// to Prisma User.lang and Clerk publicMetadata.lang (mirroring
// /api/me/language) so the preference follows the user across devices.
//
// Hardening:
//   - assertSameOrigin (CSRF) before reading the body.
//   - Per-IP token bucket (60 / 60s) since this is unauthenticated.
//   - Strict zod enum on `lang` so cookie values stay in the allow-list.

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { languageUpdateSchema } from "@/lib/validation/admin";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { isProd } from "@/lib/config";
import { ok, err } from "@/types/api";

function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "anon";
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "CSRF check failed"), {
        status: 403,
      });
    }
    throw e;
  }

  const ip = getIp(req);
  if (!(await rateLimit(ip, "locale.set", 60, 60))) {
    return NextResponse.json(err("RATE_LIMITED", "Too many requests"), {
      status: 429,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = languageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Invalid body", {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }),
      { status: 400 },
    );
  }

  const { lang } = parsed.data;

  // Best-effort auth-path persistence. Anonymous callers skip this entirely.
  const { userId: clerkUserId } = await auth();
  let clerkSynced: boolean | undefined;

  if (clerkUserId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (user) {
      // 1. Prisma — best-effort; cookie still wins on the next request.
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lang },
        });
      } catch {
        // swallow — anonymous-style cookie path stays viable.
      }

      // 2. Clerk publicMetadata.lang — best-effort.
      clerkSynced = true;
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { lang },
        });
      } catch {
        clerkSynced = false;
      }

      // Audit only on the auth path so anonymous toggles don't pollute the log.
      try {
        await logAudit({
          userId: user.id,
          action: "user.language_change",
          resourceType: "user",
          resourceId: user.id,
          ipAddress: ip === "anon" ? undefined : ip,
          metadata: { lang, clerkSynced },
        });
      } catch {
        // audit failures must never block.
      }
    }
  }

  // 3. Cookie — same parameters as /api/me/language so the resolver in
  // lib/i18n.getLocale() picks it up identically on the next request.
  const res = NextResponse.json(
    ok(clerkSynced === undefined ? { lang } : { lang, clerkSynced }),
  );
  res.cookies.set({
    name: LOCALE_COOKIE,
    value: lang,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: isProd(),
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
