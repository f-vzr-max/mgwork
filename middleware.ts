import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/roles";
import { canAccess } from "@/lib/roles";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Locale toggle must work pre-sign-up. The route handler still applies its
  // own CSRF (assertSameOrigin) + per-IP rate limit + zod enum.
  "/api/locale",
]);

const isCandidateArea = createRouteMatcher(["/candidate(.*)"]);
const isEnterpriseArea = createRouteMatcher(["/enterprise(.*)"]);
const isStaffArea = createRouteMatcher(["/staff(.*)"]);
const isAdminArea = createRouteMatcher(["/admin(.*)"]);

// Security headers — applied to every response that this middleware returns or passes through.
// CSP is intentionally permissive for Clerk + Next.js dev tooling; tighten as we lock down
// remote origins. unsafe-inline / unsafe-eval are required by Next 14 dev runtime + Clerk.
// upgrade-insecure-requests and HSTS are production-only: in dev the server is plain HTTP and
// those headers would cause the browser to rewrite all fetches to https://, breaking everything.
const isProd = process.env.NODE_ENV === "production";

function buildSecurityHeaders(): Record<string, string> {
  const cspDirectives = [
    "default-src 'self'",
    // Clerk loads JS from clerk.accounts.dev / *.clerk.accounts.dev / *.clerk.com
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];

  const headers: Record<string, string> = {
    "Content-Security-Policy": cspDirectives.join("; "),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (isProd) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  const headers = buildSecurityHeaders();
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isPublic(req)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  // Role is read from session claims (Clerk JWT template should expose publicMetadata.role).
  // Fall back to undefined if unset; user gets sent to /onboarding to complete role selection.
  const role = (sessionClaims?.metadata as { role?: Role } | undefined)?.role;

  if (!role) {
    if (!req.nextUrl.pathname.startsWith("/onboarding")) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/onboarding", req.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (isCandidateArea(req) && !canAccess(role, "candidate")) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }
  if (isEnterpriseArea(req) && !canAccess(role, "enterprise")) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }
  if (isStaffArea(req) && !canAccess(role, "staff")) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }
  if (isAdminArea(req) && !canAccess(role, "admin")) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
