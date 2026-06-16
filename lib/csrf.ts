// CSRF defense-in-depth.
//
// Clerk's session cookie is `SameSite=Lax` by default, which already blocks the
// classic cross-site form-POST CSRF vector for state-changing requests. This
// helper layers Origin/Referer validation on top so that:
//   1. A misconfigured cookie attribute (or future Clerk default change) doesn't
//      silently expose mutating endpoints.
//   2. We have a single, audit-grep-able choke point for anyone wiring up a new
//      mutation route — call `assertSameOrigin(req)` and stop thinking about it.
//
// We accept Origin OR Referer (some legitimate clients strip Origin on
// same-origin GETs; we only call this on POST/PUT/PATCH/DELETE anyway).

import { env, isProd } from "@/lib/config";

// VERCEL_URL is the unique deployment URL; VERCEL_BRANCH_URL the git-branch
// alias; VERCEL_PROJECT_PRODUCTION_URL the production alias. Users hit the
// branch alias on preview deploys, not VERCEL_URL — without all three the
// same-origin POST lands in a different host than the lambda's env (audit
// F-002). Vercel-injected values are bare hosts; the rest carry a scheme.
function getAllowedOrigins(): string[] {
  const out = new Set<string>();
  const candidates = [
    env.appUrl(),
    env.appUrlLegacy(),
    env.vercelUrl(),
    env.vercelBranchUrl(),
    env.vercelProjectProductionUrl(),
  ];
  for (const v of candidates) {
    if (!v) continue;
    const normalized = v.startsWith("http") ? v : `https://${v}`;
    try {
      out.add(new URL(normalized).origin);
    } catch {
      // ignore malformed
    }
  }
  if (!isProd()) {
    out.add("http://localhost:3000");
    out.add("http://127.0.0.1:3000");
  }
  return Array.from(out);
}

export class CsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsrfError";
  }
}

/**
 * Throws CsrfError if the request's Origin/Referer does not match one of the
 * configured app origins. Call this at the top of every mutation handler
 * (POST/PUT/PATCH/DELETE) before reading the body.
 */
export function assertSameOrigin(req: Request): void {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    // Fail closed in production; in dev we already injected localhost above.
    if (isProd()) {
      throw new CsrfError("CSRF: no allowed origins configured");
    }
    return;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Prefer Origin (set by browsers on cross-origin and on POST same-origin).
  if (origin) {
    if (allowed.includes(origin)) return;
    throw new CsrfError("CSRF: origin not allowed");
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return;
    } catch {
      throw new CsrfError("CSRF: malformed referer");
    }
    throw new CsrfError("CSRF: referer origin not allowed");
  }

  throw new CsrfError("CSRF: missing Origin and Referer headers");
}

/**
 * Boolean variant for cases where you want to branch without try/catch.
 */
export function isSameOrigin(req: Request): boolean {
  try {
    assertSameOrigin(req);
    return true;
  } catch {
    return false;
  }
}
