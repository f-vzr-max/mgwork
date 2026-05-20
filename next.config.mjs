import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

// Cookie-based locale resolution — see `i18n/request.ts`. We deliberately do
// NOT use a [locale] route segment so all existing routes (sign-in, /admin,
// /candidate, etc.) keep working without rewrites.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo lives under OneDrive on the maintainer's machine; the trace
  // collector sometimes loses files mid-rename due to OneDrive sync, which
  // breaks `next build` even though compile + static generation succeed.
  //
  // We MUST keep tracing enabled on Vercel — otherwise the serverless lambda
  // ships without the client-reference-manifest files, and every page render
  // crashes with `Cannot read properties of undefined (reading 'clientModules')`
  // in app-page.runtime.prod.js. Disabling it unconditionally was the root
  // cause of the 2026-05-20 outage (see docs/audits/).
  outputFileTracing: process.env.VERCEL ? undefined : false,
};

// next-intl always wraps the base config (M9).
const withIntlConfig = withNextIntl(nextConfig);

// Opt-in build-time guard against Clerk dev keys in production (audit F-005).
// Dev Clerk instances have a 100-user cap and bypass-able test mode — shipping
// them silently to prod = quota exhaustion + auth that doesn't behave like prod.
//
// Off by default so we can ship the audit remediation before the Clerk
// prod-instance migration. Once Francky has set pk_live_*/sk_live_* in Vercel
// Production env, ALSO set ENFORCE_CLERK_PROD_KEYS=true and the guard locks in.
// Any future regression (someone re-pasting pk_test_*) is then blocked at build.
if (
  process.env.ENFORCE_CLERK_PROD_KEYS === "true" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
) {
  throw new Error(
    "[mgwork] Refusing build with Clerk development keys " +
      "(NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY starts with pk_test_) while " +
      "ENFORCE_CLERK_PROD_KEYS=true. Either set pk_live_*/sk_live_* in this " +
      "Vercel environment, or unset ENFORCE_CLERK_PROD_KEYS to defer enforcement.",
  );
}

// Sentry env names mirror `lib/config.ts` getters (sentryDsn, sentryOrg,
// sentryProject). next.config.mjs runs in plain Node before TS is available,
// so we read process.env directly here — this is the one allowed exception
// to the "no process.env outside lib/" rule, and it's why the canonical names
// still live in lib/config.ts.
const sentryDsn = process.env.SENTRY_DSN || undefined;
const sentryOrg = process.env.SENTRY_ORG || undefined;
const sentryProject = process.env.SENTRY_PROJECT || undefined;

// When SENTRY_DSN is absent we skip withSentryConfig entirely. This means:
// - no Sentry webpack plugin runs locally
// - no source-map upload attempts
// - no auth-token errors from missing SENTRY_AUTH_TOKEN
// The moment Francky sets SENTRY_DSN (+ org/project/auth token in CI), the
// wrapper kicks in and source maps + tunneling go live with no code change.
const finalConfig = sentryDsn
  ? withSentryConfig(
      withIntlConfig,
      {
        silent: true,
        org: sentryOrg,
        project: sentryProject,
      },
      {
        widenClientFileUpload: true,
        transpileClientSDK: true,
        hideSourceMaps: true,
        disableLogger: true,
      },
    )
  : withIntlConfig;

export default finalConfig;
