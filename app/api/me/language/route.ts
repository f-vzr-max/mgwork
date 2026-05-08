// POST /api/me/language
//
// Updates the calling user's preferred language in three places:
//   1. Prisma User.lang
//   2. Clerk publicMetadata.lang  (so middleware + getLocale fall through)
//   3. Response cookie `mgwork_lang`  (so the next request renders new locale)
// Audit: `user.language_change`.

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

function getIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
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

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), {
      status: 401,
    });
  }

  if (!(await rateLimit(clerkUserId, "user.language_change", 30, 60))) {
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

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });
  if (!user) {
    return NextResponse.json(err("UNAUTHORIZED", "User not provisioned"), {
      status: 401,
    });
  }

  // 1. Prisma
  await prisma.user.update({
    where: { id: user.id },
    data: { lang: parsed.data.lang },
  });

  // 2. Clerk metadata — best effort. If this fails we still keep the DB
  // change + cookie so the UI updates; surface a 207-ish behavior via the
  // payload.
  let clerkOk = true;
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { lang: parsed.data.lang },
    });
  } catch {
    clerkOk = false;
  }

  await logAudit({
    userId: user.id,
    action: "user.language_change",
    resourceType: "user",
    resourceId: user.id,
    ipAddress: getIp(req) ?? undefined,
    metadata: { lang: parsed.data.lang, clerkSynced: clerkOk },
  });

  // 3. Cookie — set on the response so the next request reads the new locale.
  // Use SameSite=Lax so it survives top-level navigations and matches the
  // Clerk session cookie's policy.
  const res = NextResponse.json(
    ok({ lang: parsed.data.lang, clerkSynced: clerkOk }),
  );
  res.cookies.set({
    name: LOCALE_COOKIE,
    value: parsed.data.lang,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: isProd(),
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
