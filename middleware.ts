import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/roles";
import { canAccess } from "@/lib/roles";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isCandidateArea = createRouteMatcher(["/candidate(.*)"]);
const isEnterpriseArea = createRouteMatcher(["/enterprise(.*)"]);
const isStaffArea = createRouteMatcher(["/staff(.*)"]);
const isAdminArea = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  // Role is read from session claims (Clerk JWT template should expose publicMetadata.role).
  // Fall back to undefined if unset; user gets sent to /onboarding to complete role selection.
  const role = (sessionClaims?.metadata as { role?: Role } | undefined)?.role;

  if (!role) {
    if (req.nextUrl.pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return;
  }

  if (isCandidateArea(req) && !canAccess(role, "candidate")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isEnterpriseArea(req) && !canAccess(role, "enterprise")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isStaffArea(req) && !canAccess(role, "staff")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isAdminArea(req) && !canAccess(role, "admin")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
