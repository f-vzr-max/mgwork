# 2026-05-20 — Production live-site audit

## Verdict

**FAIL — site is fully down.** Every page on `https://mgwork-seven.vercel.app/` returns HTTP 500. The preview deploy at `https://mgwork-git-feature-m2-m8-bulk-ship-f-vzr-maxs-projects.vercel.app/` is also affected (same SHA `367c493`). Middleware itself is alive (auth redirects fire correctly), but the page-render layer crashes server-side on every request. Build succeeded at Vercel — this is a runtime-only failure.

## Method

Driven by `@playwright/mcp@latest` (extension mode, connected to user's real Chrome session via the Playwright Chrome extension). Each route was navigated, console + network captured. Runtime logs read directly from the Vercel dashboard (`vercel.com/.../41mQg7v2P8UtLReqEmcSgrLJ63Gv/logs`) — also via the live Chrome session, no Vercel CLI / token required. No authenticated routes were exercised beyond confirming middleware redirects.

Scope per the approved plan: render + console + network. No screenshots, no a11y, no Lighthouse.

## Results

| Route | Final URL | Page status | Document title | Console errs | Failed reqs | Notes |
|-------|-----------|-------------|----------------|--------------|-------------|-------|
| `/` | `/?audit=1` | **500** | `500: Internal Server Error` | 4 | 6 (incl. RSC `index.json` HEADs) | Body `500\nInternal Server Error.` |
| `/sign-in` | same | **500** | same | 1 | n/a | Clerk widget never reached |
| `/sign-up` | same | **500** | same | 1 | n/a | Clerk widget never reached |
| `/dashboard` | `/sign-in?redirect_url=...` | **500** (after redirect) | same | 2 | n/a | Auth gate fires correctly, then `/sign-in` 500s |
| `/onboarding` | `/sign-in?redirect_url=...` | **500** (after redirect) | same | 1 | n/a | Same pattern |
| `/this-route-does-not-exist` | `/sign-in?redirect_url=...` | **500** (after redirect) | same | 1 | n/a | Middleware sends every unknown route to sign-in; sign-in 500s |
| `/api/locale` | (browser navigation) | navigation error | — | — | — | `net::ERR_HTTP_RESPONSE_CODE_FAILURE` on direct GET. Route is POST-only; this isn't necessarily the auth/render bug, but couldn't be smoke-tested via browser navigation. |
| `/` (preview deploy) | same on preview host | **500** | same | 3 | — | Confirms it's not a production-env-vars-only issue; preview running the same SHA is equally broken. |

## Root cause finding

**BLOCKER #1 — Next.js page-render boundary corruption**

Stack from Vercel runtime logs (identical across `/`, `/sign-in`, `/sign-up`, repeated tens of times):

```
TypeError: Cannot read properties of undefined (reading 'clientModules')
    at /var/task/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:17:24397
    at /var/task/node_modules/next/dist/server/lib/trace/tracer.js:191:62
    at /var/task/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (.../@opentelemetry/api/build/src/context/NoopContextManager.js:14:19)
    at ContextAPI.with (.../@opentelemetry/api/build/src/api/context.js:51:46)
    at NoopTracer.startActiveSpan (.../@opentelemetry/api/build/src/trace/NoopTracer.js:54:31)
    at ProxyTracer.startActiveSpan (.../@opentelemetry/api/build/src/trace/ProxyTracer.js:27:24)
    ...
    { page: '/' }   // also '/sign-in', '/sign-up'
```

`clientModules` undefined inside `app-page.runtime.prod.js` is the well-known signature of a corrupted **client-reference-manifest** at request time. It is NOT a code-level exception; it is Next.js failing to look up which client modules to hydrate. Classic triggers:

- A barrel file (`components/mg/index.ts`) re-exports both server-marked and `"use client"`-marked modules — Next 14's build sometimes loses the boundary info under that pattern.
- A `next/font/google` load failed during build and Next still emitted a manifest entry that resolves to `undefined`.
- Provider stack in `app/layout.tsx` changed (added `ThemeProvider` from `next-themes`) and one of its imports is being treated as both server- and client-routed.
- A node_modules cache mismatch between build environment and runtime (less likely on Vercel).

**Affected commits/deploys**:
- `367c493` "MG Work Hi-Fi: design system port across 5 areas" — current Production + Preview (deployed 2026-05-20 06:32 UTC for preview, manually promoted to Production at 08:40 UTC).
- Previous Production was `4c6763f` (Merge PR #1, deployed 2026-05-10) — not audited here but worth verifying it serves successfully before doing any rollback.

## Other observations (not findings)

- **OBSERVATION-1** — Middleware is alive. `/dashboard`, `/onboarding`, `/this-route-does-not-exist`, etc. all redirect to `/sign-in?redirect_url=...` correctly. The 500 is purely at page-render time, not at middleware time. CSP + security headers (X-Frame-Options, etc.) are also still applied — these come from middleware.
- **OBSERVATION-2** — PR #2 is still **OPEN**, but a deployment of its head SHA was manually promoted to the Production environment (`mgwork-oxpyph8yt-f-vzr-maxs-projects.vercel.app` alias `mgwork-seven.vercel.app`). The previous Production from 2026-05-10 is still in Vercel's deployment history and can be re-promoted in one click as a fast unblock.
- **OBSERVATION-3** — Build itself succeeded (Vercel state `Ready`, GitHub Actions CI green). Local `npm run build` also passes. The crash only surfaces in the Vercel runtime, which suggests an interaction between the production build output and the Vercel server runtime — not visible in local builds.

## Recommended next actions

In priority order. None require code changes from the audit itself; remediation is a separate task.

1. **Fast unblock (≤2 min)** — In Vercel, **promote the last known-good Production deployment** (`4c6763f`, 2026-05-10). This restores service while we diagnose. Vercel UI: Deployments → find `4c6763f` → "Promote to Production".
2. **Bisect the regression** — Locally, run a `next start` against the production build (`npm run build && npm run start`) and reproduce the 500. If it does NOT reproduce locally, the cause is environment-specific (Vercel runtime / Node version / env-var-dependent code). If it DOES reproduce, the boundary issue is in the code.
3. **Suspect-first inspection** — `app/layout.tsx`, `components/mg/index.ts` (barrel), `components/mg/theme-provider.tsx`, and any new use of `next/font` in the design-system commit. Try temporarily replacing the barrel imports in `app/layout.tsx` with direct path imports (`@/components/mg/theme-provider` instead of via the barrel) and rebuild.
4. **Inspect `next.config.mjs`** for any `output: "standalone"`, `experimental.*`, or Sentry wrapper changes that might affect the client manifest. Confirm `@sentry/nextjs` version matches the Next 14.2.35 install.
5. **Verify Vercel env vars** present on the deployment: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SENTRY_DSN` (if intended to be enabled).
6. **Once a fix candidate exists**, deploy to Preview first, verify via the same Playwright sweep, then promote.

## Out of scope (per audit plan)

- Visual screenshots (light/dark, mobile/desktop)
- Accessibility (axe-core)
- Performance / Lighthouse
- Authenticated user flows beyond redirect verification
- Any code changes / fixes (this is an audit only)
- Validation of new design system on the preview URL beyond confirming it also 500s

## Reproduce locally

```bash
# Same audit, deterministic
cd projects/mgwork
PLAYWRIGHT_BASE_URL=https://mgwork-seven.vercel.app \
  npx playwright test tests/e2e/public-pages.spec.ts --reporter=list
```

Or hit any of these URLs in any browser:
- https://mgwork-seven.vercel.app/
- https://mgwork-seven.vercel.app/sign-in
- https://mgwork-seven.vercel.app/sign-up

All return the same `500: Internal Server Error` body until the BLOCKER above is resolved.
