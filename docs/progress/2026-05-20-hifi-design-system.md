# 2026-05-20 — Hi-Fi design system port

## What shipped today

Full integration of the Claude Design hi-fi bundle (`MG Work Hi-Fi.html`) into the live app. Visual layer for the entire platform — public marketing, candidate (mobile-first responsive), enterprise, admin, staff. Functional layers (auth, data, APIs, business logic) preserved unchanged.

### Foundation

- [`app/globals.css`](../../app/globals.css) — MG palette in HSL channels (light + dark), type ladder (`.mg-display` → `.mg-micro`), focus ring, tinted-bg vars, `mg-pulse-soft` animation.
- [`tailwind.config.ts`](../../tailwind.config.ts) — added `warning`, `info`, `surface-{1,2,3}` tokens + tinted-bg utility colors + JetBrains Mono font family.
- [`app/layout.tsx`](../../app/layout.tsx) — `ThemeProvider` (next-themes, light + dark + system), Inter + JetBrains Mono via `next/font`, themed Clerk appearance consuming MG tokens. ClerkProvider, NextIntlClientProvider, Sentry, Vercel Analytics all preserved.
- `next-themes` added to dependencies.

### Design system primitives ([`components/mg/`](../../components/mg/))

24 TypeScript primitives + barrel `index.ts`:

`Icon` `Stack` `Hairline` `Button` `Card` `Badge` `StatusBadge` `Avatar` `ScoreGauge` `Sparkline` `Progress` `KpiCard` `Wordmark` `PageHeader` `WebSidebar` `CandAppBar` `CandTabBar` `Input` `Textarea` `LanguageMenu` `ThemeToggle` `ThemeProvider` `PublicShell`/`PublicHeader`/`PublicFooter` `Section`/`SectionHeader`.

Server-renderable by default; only `Button`, `WebSidebar`, `CandAppBar`, `CandTabBar`, `LanguageMenu`, `ThemeToggle`, `ThemeProvider`, `PublicHeader` are `"use client"`.

### Pages (29 routes restyled)

| Area | Routes |
|------|--------|
| Public marketing | `/`, `/candidats`, `/entreprises`, `/conformite`, `/tarifs` |
| Candidate (mobile-first, `lg:` desktop split) | `/candidate`, `/candidate/matches`, `/candidate/chat`, `/candidate/documents`, `/candidate/applications` |
| Enterprise (`WebSidebar` shell) | `/enterprise`, `/enterprise/candidates`, `/enterprise/documents`, `/enterprise/interviews`, `/enterprise/offers` |
| Admin (`WebSidebar` shell) | `/admin`, `/admin/matching-config`, `/admin/disputes`, `/admin/users`, `/admin/audit`, `/admin/invoices`, `/admin/i18n`, `/admin/feature-flags` |
| Staff (`WebSidebar` shell) | `/staff`, `/staff/documents`, `/staff/followup` |
| Auth | `/sign-in`, `/sign-up` wrapped in MG public chrome with themed Clerk widget |

### Middleware

[`middleware.ts`](../../middleware.ts) extended: `(public)` marketing routes (`/candidats`, `/entreprises`, `/conformite`, `/tarifs`) added to `isPublic` matcher. Role gates and security headers untouched.

### Tests

[`tests/e2e/public-pages.spec.ts`](../../tests/e2e/public-pages.spec.ts) — Playwright smoke specs. Every public URL renders without console errors; language menu lists FR + EN only (MG hidden per spec); theme toggle round-trips light ↔ dark; unauthenticated `/candidate` redirects.

### Cleanup

Removed dead code: `components/LanguageToggle.tsx`, `components/layout/sidebar.tsx`, `components/layout/LanguageSwitcher.tsx`.

Kept as compatibility shims (auto-inherit MG palette via Tailwind tokens):
- `components/ui/{button,card,input}.tsx`
- `components/layout/page-header.tsx`

Used by 9 detail/edit pages (`*/[id]`, `*/new`) and onboarding business components.

## Where it lives

- **Branch**: `feature/m2-m8-bulk-ship`
- **Commit**: `367c493` — *MG Work Hi-Fi: design system port across 5 areas*
- **Diff**: 77 files, +9833 / -1889
- **PR**: [#2](https://github.com/f-vzr-max/mgwork/pull/2) → `main` (mergeable, awaiting review)
- **Vercel preview**: https://mgwork-git-feature-m2-m8-bulk-ship-f-vzr-maxs-projects.vercel.app *(Ready)*
- **Production**: not yet — `mgwork-seven.vercel.app` deploys when PR #2 merges to `main`
- **Plan file** (archived locally): `C:\Users\Administrator\.claude\plans\fetch-this-design-file-fuzzy-candle.md`

## Health metrics

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (no warnings) |
| `npm run build` | PASS (62 routes) |
| `npm run test` | PASS (12 suites, 139 tests, 7.7s) |
| GitHub Actions CI | running on PR #2 |
| Vercel preview deploy | READY |

## Known follow-ups (deferred, not blockers)

| Priority | Item | Notes |
|----------|------|-------|
| MAJOR | i18n extraction for new pages | Inline FR copy across 29 pages. Locale toggle to EN falls back to French for new design copy until extracted. Original 210 chrome keys still translate. |
| MINOR | 9 detail/edit pages on shadcn shims | `*/[id]`, `*/new` routes use old `components/ui/*` and `components/layout/page-header.tsx`. Visually slightly off-system but auto-inherit MG palette. |
| MINOR | Onboarding visual restyle | Functional + auto-inherits palette. Could be ported to MG primitives for chrome consistency; design bundle had no onboarding artboards. |

## Project advancement audit

### Phase status vs [`roadmap.md`](../roadmap.md)

| Phase | Target | Status as of 2026-05-20 |
|-------|--------|--------------------------|
| 1 — Foundations | week of 2026-05-04 | **Done.** Scaffold, auth, DB, CI, design tokens live. Sentry config gated on env var; Vercel Analytics rendered in layout. |
| 2 — Profiles & Documents | week of 2026-05-11 | **Largely done.** Candidate + enterprise onboarding flows shipped (`app/onboarding/{candidate,enterprise}/`). CV extraction (`/api/ai/extract-cv`), document wallet (`/api/documents`), expiry alerts cron (`/api/cron/expiry-alerts`), staff validation queue (`/staff/documents`) all in place. |
| 3 — AI Matching | week of 2026-05-18 | **In progress.** Matching endpoint (`/api/ai/match`) live, admin matching-config page with weighted sliders + live ScoreGauge shipped today. Enterprise shortlist UI styled with `KpiCard` + `ScoreGauge`. Proactive suggestion notifications not yet wired. |
| 4 — Social Chat & LLM | week of 2026-05-25 | **Partially scaffolded.** Meta webhook stub at `/api/webhooks/meta`. Candidate in-app chat live (`/candidate/chat` with `/api/chat` SSE). WhatsApp Business + Messenger + Instagram channels not yet integrated. |
| 5 — Interviews & Deployment | week of 2026-06-01 | **Partially scaffolded.** Interview model + APIs (`/api/interviews`, calendar widget at `components/calendar/`) exist. Departure checklist component (`components/checklist/DepartureChecklist.tsx`), country guide integration (`components/integration/CountryGuide.tsx`), staff follow-up dashboard (`/staff/followup`) shipped today. Video interview embed (Daily.co / Whereby) not yet integrated. |
| 6 — Monetization & Launch | week of 2026-06-08 | **Partially scaffolded.** Invoice model + admin invoices pages, freemium quota rail on enterprise dashboard, multilanguage plumbing (next-intl + cookie-based locale resolution + LanguageMenu). End-to-end Playwright tests for marketing + auth flow live; full critical-journey coverage pending. |

### Cross-cutting capabilities live

- **Auth**: Clerk JWT + role-based middleware. Roles: SUPER_ADMIN, ADMIN, STAFF_FOLLOWUP, STAFF_DOCUMENTS, ENTERPRISE, CANDIDATE.
- **DB**: Prisma + Supabase Postgres. Models cover User, Candidate, Enterprise, JobOffer, Application, Document, Interview, Chat, Checkpoint, Invoice, AuditLog, StaffNote, OnboardingDraft.
- **Storage**: Supabase buckets (passports, medical-docs, cvs, scans, visas) with signed URLs via `lib/supabase.ts`.
- **AI**: Anthropic Claude SDK. Endpoints for `extract-cv`, `match`, `lang-test`, `interview-sim`, `chat`.
- **Email**: Resend SDK wired (`lib/resend.ts`); welcome + expiry alert templates in React Email.
- **i18n**: next-intl with cookie-based resolution. FR (default) + EN fully populated for chrome; MG file present but hidden from UI in v1.
- **Security**: CSP, X-Frame-Options, HSTS in prod, RLS policies, rate limiting on public routes, signed-URL document access.
- **Observability**: Sentry config conditional on `SENTRY_DSN`; Vercel Analytics mounted.

## Next on deck

1. **Review preview deploy** — smoke-test against [smoke-test runbook](../smoke-test-runbook.md)
2. **Merge PR #2** to `main` → production deploys to `mgwork-seven.vercel.app`
3. **Phase 3 completion** — proactive matching notifications (enterprise side) + Phase 3 acceptance criteria from roadmap §6.3
4. **i18n extraction** for new design copy (deferred from this commit)
5. **Phase 4 kickoff** — Meta Cloud API integration for WhatsApp / Messenger entry funnel
