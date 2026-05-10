# Phase 1 — Foundations

**Goal**: Project scaffold, auth, database, CI/CD, design system live
**Target week**: 2026-05-04
**Deliverable**: Authenticated shell with role routing, empty dashboards, DB connected

**Status**: code scaffold + DB + repo done as of 2026-04-30. Remaining work is account/dashboard config (Clerk, Supabase Storage, Vercel) + the MEDIUM tier integrations.

---

## Done

- [x] **1.** GitHub repo `mgwork` created and pushed (`main` + `develop`); branching strategy documented in [README](../../README.md)
- [x] **2.** Next.js 14 + TypeScript + Tailwind + ESLint scaffolded
- [x] **3.** Supabase project created, `SUPABASE_URL` + anon + service role keys in `.env.local`
- [x] **4.** `@clerk/nextjs` v6 installed and wired (`ClerkProvider` in root layout, sign-in/sign-up pages, env vars set) — Clerk dashboard role config still pending (see below)
- [x] **5.** Prisma schema (roadmap §5) written + initial migration `20260430054145_init` ran successfully against Supabase
- [x] **6.** shadcn-style base components added manually (`Button`, `Input`, `Card`) at [components/ui/](../../components/ui/)
- [x] **7.** Tailwind design tokens configured: brand blue `#1A3C6E`, green `#007B55`, red `#C0392B`, white — see [tailwind.config.ts](../../tailwind.config.ts) and [globals.css](../../app/globals.css)
- [x] **8.** Role-based middleware at [middleware.ts](../../middleware.ts): protects `/candidate`, `/enterprise`, `/staff`, `/admin`; reads role from Clerk session claims
- [x] **9.** Role-based layouts with dynamic sidebar nav for all 4 areas
- [x] **10.** Anthropic API key in `.env.local`
- [x] GitHub Actions CI workflow (lint + typecheck + build) at [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [x] Prettier + Tailwind plugin configured
- [x] Path alias `@/*` working (verified by typecheck + build)

---

## Pending — manual / dashboard config

These need you in front of the relevant dashboard. Order them however you like.

### CRITICAL — blocks the auth flow from working end-to-end

- [x] **A. Clerk dashboard — finish role setup**
  - JWT template created exposing `metadata.role` from `publicMetadata`
  - New signups default to `CANDIDATE` via webhook; admin sets role in Clerk dashboard

- [x] **B. Clerk → Postgres user sync (webhook)**
  - Webhook handler at `app/api/webhooks/clerk/route.ts` — upserts on `user.created` / `user.updated`
  - Default role: `CANDIDATE`; overridden by `publicMetadata.role` when admin sets it
  - Deployed and verified working (2026-05-01)

### HIGH — needed before Phase 2

- [x] **C. Supabase Storage buckets**
  - 5 buckets created: `passports`, `medical-docs`, `cvs`, `scans`, `visas`
  - All private

- [x] **D. Vercel deploy**
  - Production deployed at `mgwork-seven.vercel.app`
  - All env vars set in Vercel (including `CLERK_WEBHOOK_SECRET`)

### CRITICAL for Phase 1 ship

- [ ] **E. Sentry**
  - Create Sentry project (Next.js)
  - Run `npx @sentry/wizard@latest -i nextjs` to scaffold the SDK
  - Add `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` to env
  - Verify error tracking by triggering a test exception

- [ ] **F. Vercel Analytics**
  - `npm install @vercel/analytics` → add `<Analytics />` in root layout
  - Enable in Vercel project settings

---

## Phase 2 (deferred)

- **E. Meta Cloud API (WhatsApp, Messenger, Instagram, TikTok)**
  - Apply for Meta Cloud API access (Business Manager → all channels)
  - Once approved: add `META_CLOUD_API_TOKEN`, `META_PHONE_NUMBER_ID`, `META_VERIFY_TOKEN` to `.env.local` and Vercel
  - Integrate Messenger, Instagram DMs, TikTok Shop messaging

- **G. Resend**
  - Create Resend account + verify your sending domain
  - Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to env
  - Author welcome email + document-expiry alert templates (React Email)

---

## Verification — Phase 1 done means

- `npm run dev`, hit `/sign-up`, create an account → land on `/onboarding` (because no role yet)
- Set your role to `SUPER_ADMIN` in Clerk → refresh → you reach `/admin` with the sidebar
- Same flow with role `CANDIDATE` lands on `/candidate`, etc. for the other 3 roles
- A push to `develop` triggers Vercel preview build successfully
- A push or PR to `main`/`develop` triggers GitHub Actions CI green
- Sentry catches a deliberately-thrown test error
- Vercel Analytics dashboard shows page views

When all 6 ✓, Phase 1 ships.
