// Next.js instrumentation hook. Required by @sentry/nextjs v8+ — the legacy
// `sentry.{server,edge}.config.ts` files are NOT auto-loaded by the SDK
// anymore. Without this file, Sentry's auto-instrumentation hooks still wrap
// the Next.js page runtime but Sentry.init() never runs, leaving the
// OpenTelemetry tracer in a half-initialized state. The Vercel runtime then
// crashes with `Cannot read properties of undefined (reading 'clientModules')`
// in `app-page.runtime.prod.js` on every page render. See:
//   https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
//
// Strategy: re-export Sentry.captureRequestError for App Router error capture,
// and dynamically import the legacy config files in `register()` so they
// continue to be the single source of Sentry.init() options (DSN, sample rate,
// env tagging). Lazy import keeps the bundle clean per runtime.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
  // Runtime belt for the build-time check in next.config.mjs. Same opt-in flag
  // so the two stay in lockstep — only log loudly once the operator has
  // committed to prod-keys enforcement.
  if (
    process.env.ENFORCE_CLERK_PROD_KEYS === "true" &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
  ) {
    console.error(
      "[mgwork] Runtime is using Clerk development keys (pk_test_*) while " +
        "ENFORCE_CLERK_PROD_KEYS=true. Auth will hit the 100-user dev cap. " +
        "Update Vercel env.",
    );
  }
}

export const onRequestError = Sentry.captureRequestError;
