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

const APP_URL_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "VERCEL_URL", // set by Vercel — bare host, no scheme
] as const;

function getAllowedOrigins(): string[] {
  const out = new Set<string>();
  for (const key of APP_URL_ENV_KEYS) {
    const v = process.env[key];
    if (!v) continue;
    // VERCEL_URL is bare host
    const normalized = v.startsWith("http") ? v : `https://${v}`;
    try {
      out.add(new URL(normalized).origin);
    } catch {
      // ignore malformed
    }
  }
  // Always allow localhost in dev
  if (process.env.NODE_ENV !== "production") {
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
    if (process.env.NODE_ENV === "production") {
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
