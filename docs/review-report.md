# MG Work — Cross-Cutting Review Report

Wave 1 + Wave 2 audit, prepared by `reviewer` for handoff to Francky.

---

## Executive summary

- All six verification gates pass: typecheck, lint, jest (130/130), playwright list, security:check, next build.
- File-size, env-var, PII, storage-path, and CSRF discipline are clean — no blockers found.
- Audit-key naming has 7 contract↔code mismatches (cosmetic; pick one and update the other side). Contract also lists six list/read keys that the code never emits — these are GETs, optional to audit.
- i18n parity is perfect across FR/EN/MG (102 keys each). 101/102 MG values are still `[MG-TODO]` placeholders — expected per plan, needs a translator pass before launch.
- Open follow-ups requiring human action: apply RLS SQL, set Sentry/Resend/Meta envs, MFA enable in Clerk, MG translation pass.

---

## 1. Verification matrix

| Step | Command | Exit | Notes |
|---|---|---|---|
| Typecheck | `npm run typecheck` | 0 | clean |
| Lint | `npm run lint` | 0 | "✔ No ESLint warnings or errors" |
| Unit tests | `npm test` | 0 | 12 suites, 130 tests, ~14 s |
| E2E compile | `npx playwright test --list` | 0 | 4 spec files compile (chromium) |
| Security check | `npm run security:check` | 0 | 0 warnings, 0 failures |
| Build | `NEXT_DIST_DIR=/tmp/mgwork-next npm run build` | 0 | All routes built; OneDrive workaround active via `outputFileTracing: false` |

All six pass. Build emits the full route list including the M2–M8 surfaces.

---

## 2. File-size compliance

CLAUDE.md cap = 500 lines. Largest files:

| Lines | File |
|---|---|
| 334 | [`scripts/security-check.ts`](../scripts/security-check.ts) |
| 331 | [`lib/social/llm-bridge.ts`](../lib/social/llm-bridge.ts) |
| 309 | [`app/api/documents/[id]/route.ts`](../app/api/documents/[id]/route.ts) |
| 304 | [`components/checklist/DepartureChecklist.tsx`](../components/checklist/DepartureChecklist.tsx) |
| 304 | [`app/api/ai/interview-sim/route.ts`](../app/api/ai/interview-sim/route.ts) |
| 280 | [`app/api/ai/extract-cv/route.ts`](../app/api/ai/extract-cv/route.ts) |
| 271 | [`app/api/interviews/route.ts`](../app/api/interviews/route.ts) |
| 261 | [`lib/scoring.ts`](../lib/scoring.ts) |
| 255 | [`app/api/documents/route.ts`](../app/api/documents/route.ts) |
| 245 | [`app/api/offers/[id]/route.ts`](../app/api/offers/[id]/route.ts) |

All clean. No TS/TSX file exceeds 500 lines. Total TS/TSX LOC: ~20,092.

---

## 3. PII discipline (audit metadata)

Reviewed every `logAudit*(` and `prisma.auditLog.create(` site (38 callers across 38 files). Pattern observed:

- Email addresses: only `targetEmailDomain: target.email.split("@")[1]` (domain breadcrumb) — see `app/api/admin/users/[id]/{ban,role,impersonate,erasure}/route.ts`.
- No phone, passport, or full-name fields appear in audit metadata.
- Storage object paths are NEVER logged in `document.upload` metadata — only `{ type, bucket, sizeBytes, mime, ownerKind }` (see [`app/api/documents/route.ts:240-252`](../app/api/documents/route.ts)).
- Fingerprint pattern in chat / AI flows logs `{ messageHash, charsIn, charsOut, language }` only.

All clean.

---

## 4. Storage path discipline

Single upload site: [`app/api/documents/route.ts:212`](../app/api/documents/route.ts) calls `buildDocumentObjectPath(...)` from [`lib/documents.ts:54`](../lib/documents.ts), which produces `{role}/{userId}/{type}/{uuid}-{filename}`. `userId` is the **internal `User.id` cuid** (from `prisma.user.findUnique`), never the Clerk id — confirmed by docstring on the helper. RLS expectation in [`supabase/policies.sql`](../supabase/policies.sql) (`storage.foldername(name)[2] = current_user_id()`) matches.

All clean.

---

## 5. Audit key coverage

Cross-referenced [`docs/contracts.md`](contracts.md) action keys against `grep -ho 'action: "..."'` over `app/api/**/*.ts`.

### Contract keys missing from code (mutation handlers)

| Contract key | Resolution |
|---|---|
| `candidate.update` | No PATCH route exists (`/api/candidates/[id]` not implemented). Skip — not in scope of Wave 2. |
| `enterprise.update` | Same as above. Skip. |
| `offer.publish` | Folded into `offer.update` — `PATCH /api/offers/[id]` handles DRAFT→ACTIVE transition with the freemium gate. Code matches plan; contract row is redundant. |
| `webhook.meta_verify` | The GET handshake doesn't audit (it's a public health check). Acceptable. |
| `interview.create` | **Mismatch.** Code emits `interview.schedule` instead. Pick one — update contract or rename in [`app/api/interviews/route.ts:140`](../app/api/interviews/route.ts). |
| `application.checklist_update` | **Mismatch.** Code emits `candidate.departure_checklist_update`. Pick one — see [`app/api/me/departure-checklist/route.ts:111`](../app/api/me/departure-checklist/route.ts). |
| `feature_flag.update` | **Mismatch.** Code emits `feature_flag.toggle` ([`app/api/admin/feature-flags/route.ts:77`](../app/api/admin/feature-flags/route.ts)). |
| `translation.upsert` | **Mismatch.** Code emits `translation.update` ([`app/api/admin/translations/route.ts:91`](../app/api/admin/translations/route.ts)). |
| `user.data_export` | **Mismatch.** Code emits `user.export` ([`app/api/me/data-export/route.ts:85`](../app/api/me/data-export/route.ts)). |
| `interview.list`, `user.list`, `audit.read`, `feature_flag.list` | GET endpoints; not audited. Acceptable — reads typically don't audit. Contract should drop these rows. |

### Code keys absent from contract

| Code key | Reason |
|---|---|
| `offer.delete` | New DELETE handler in `app/api/offers/[id]`. Add to contract. |
| `invoice.update` | PATCH `/api/admin/invoices/[id]`. Add to contract (table currently lists `invoice.create` + `invoice.mark_paid` only). |
| `user.impersonate` | Sub-route per plan §M8 split ([`app/api/admin/users/[id]/impersonate`](../app/api/admin/users/[id]/impersonate/route.ts)). Add to contract. |
| `user.language_change` | New `POST /api/me/language`. Add to contract. |
| `checkin.respond` | `POST /api/cron/monthly-checkin/respond` — candidate response endpoint. Add to contract. |
| `matching_config.read` | Already in contract; emitted by GET (read-on-write). Fine. |

### Method-vs-contract mismatches

- Contract: `/api/admin/users/[id]/role` is **PUT** → code is **POST** ([`role/route.ts:23`](../app/api/admin/users/[id]/role/route.ts)). Functional, but pick one.
- Contract: `/api/admin/feature-flags/[key]` PUT → code is `/api/admin/feature-flags` PUT (no `[key]` segment; key is in body). Both are reasonable; update contract.

These are all cosmetic — the routes work, the audit log is consistent, and the choice for Francky is whether to update the contract document or rename the action keys. Recommend updating the contract since the code is shipped.

---

## 6. API auth + audit + CSRF compliance

37 `app/api/**/route.ts` files audited. Helper map:

- `requireAdmin(...)` — internal CSRF + Clerk auth + role check ([`lib/admin-guard.ts:51`](../lib/admin-guard.ts)). `skipCsrf: true` is allowed ONLY on GETs.
- `requireStaffActor(...)` — Clerk auth + role check; **does NOT do CSRF**, so staff route handlers call `assertSameOrigin(req)` explicitly ([`lib/staff-auth.ts:36`](../lib/staff-auth.ts)).
- Cron routes: `Authorization: Bearer ${CRON_SECRET}` via `env.cronSecret()`, constant-time-ish compare; no CSRF/auth().
- Webhooks (`/api/webhooks/*`): signature verification (HMAC for Meta, svix for Clerk); no CSRF/auth().

| Route | Mutation methods | auth | csrf | audit | Notes |
|---|---|---|---|---|---|
| `app/api/candidates/route.ts` | POST | ok | ok | ok | |
| `app/api/enterprises/route.ts` | POST | ok | ok | ok | |
| `app/api/documents/route.ts` | POST | ok | ok | ok | GET also audited via `document.read` |
| `app/api/documents/[id]/route.ts` | PATCH, DELETE | ok | ok | ok | |
| `app/api/documents/[id]/signed-url/route.ts` | (GET only — issuance) | ok | n/a (GET) | ok | Deliberately skips CSRF so `<a href>` flows work; documented in route header |
| `app/api/staff/checkpoints/route.ts` | POST | ok (staff-auth) | ok (explicit) | ok | |
| `app/api/staff/notes/route.ts` | POST | ok | ok | ok | |
| `app/api/staff/documents/[id]/approve/route.ts` | POST | ok | ok | ok | |
| `app/api/staff/documents/[id]/reject/route.ts` | POST | ok | ok | ok | |
| `app/api/offers/route.ts` | POST | ok | ok | ok | |
| `app/api/offers/[id]/route.ts` | PATCH, DELETE | ok | ok | ok | |
| `app/api/ai/match/route.ts` | POST | ok | ok | ok | |
| `app/api/ai/extract-cv/route.ts` | POST | ok | ok | ok | |
| `app/api/ai/lang-test/route.ts` | POST | ok | ok | ok | |
| `app/api/ai/interview-sim/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/matching-config/route.ts` | PUT | ok | ok | ok | |
| `app/api/admin/translations/route.ts` | PUT | ok | ok (`requireAdmin`) | ok | |
| `app/api/admin/feature-flags/route.ts` | PUT | ok | ok (`requireAdmin`) | ok | |
| `app/api/admin/invoices/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/invoices/[id]/route.ts` | PATCH | ok | ok | ok | |
| `app/api/admin/invoices/[id]/mark-paid/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/users/[id]/ban/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/users/[id]/role/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/users/[id]/impersonate/route.ts` | POST | ok | ok | ok | |
| `app/api/admin/users/[id]/erasure/route.ts` | POST | ok | ok | ok | Manual `auth()` + role check (GDPR — fails loudly) |
| `app/api/me/data-export/route.ts` | (GET only) | ok | n/a (GET) | ok | GDPR; uses raw `prisma.auditLog.create` |
| `app/api/me/language/route.ts` | POST | ok | ok | ok | |
| `app/api/me/departure-checklist/route.ts` | PATCH | ok | ok | ok | |
| `app/api/interviews/route.ts` | POST | ok | ok | ok | |
| `app/api/interviews/[id]/route.ts` | PATCH | ok | ok | ok | |
| `app/api/chat/route.ts` | POST | ok | ok | ok | |
| `app/api/cron/expiry-alerts/route.ts` | POST | n/a (cron) | n/a (cron) | ok (raw create) | Bearer-token check ok |
| `app/api/cron/monthly-checkin/route.ts` | POST | n/a (cron) | n/a (cron) | ok | Bearer-token check ok |
| `app/api/cron/monthly-checkin/respond/route.ts` | POST | ok (Clerk) | ok | ok | Candidate-side response, not cron-triggered despite path |
| `app/api/cron/monthly-report/route.ts` | POST | n/a (cron) | n/a (cron) | ok | Bearer-token check ok |
| `app/api/webhooks/meta/route.ts` | POST | n/a (HMAC) | n/a (signed) | ok | |
| `app/api/webhooks/clerk/route.ts` | POST | n/a (svix) | n/a (signed) | n/a | Webhook itself isn't user-attributed; user is provisioned by it. Acceptable. |

All clean.

---

## 7. Env-var discipline

Total `process.env.*` references: 7. All in legitimate locations:

- [`lib/csrf.ts`](../lib/csrf.ts) — env getter (lib/, allowed)
- [`lib/prisma.ts`](../lib/prisma.ts) — log level (lib/, allowed)
- [`scripts/security-check.ts`](../scripts/security-check.ts) — the linter itself (allowed)
- [`playwright.config.ts`](../playwright.config.ts) — root config file (allowed by rule + linter exemption for `*.config.ts`)
- [`next.config.mjs`](../next.config.mjs) — Sentry wrapper (documented exception in file header; mjs runs before TS is loaded)

`SUPABASE_SERVICE_ROLE_KEY` only referenced inside [`lib/supabase.ts`](../lib/supabase.ts) and [`lib/config.ts`](../lib/config.ts). All clean.

---

## 8. i18n coverage

3 dictionaries, identical key sets:

| Lang | Keys | Translated | Placeholders |
|---|---|---|---|
| FR | 102 | 102 | 0 |
| EN | 102 | 102 | 0 |
| MG | 102 | 1 (`common.appName` = "MG Work") | 101 (`[MG-TODO]` prefix) |

No missing keys in any dictionary. All MG strings carry the `[MG-TODO]` prefix per plan; expected. Translator pass needed before launch.

---

## 9. Documented TODOs / FIXMEs

| File | Line | Note |
|---|---|---|
| [`lib/aidefence.ts`](../lib/aidefence.ts) | 9 | Replace internal scoring with `aidefence_scan` MCP call once available. |
| [`tests/e2e/onboarding-candidate.spec.ts`](../tests/e2e/onboarding-candidate.spec.ts) | 7 | Expand once M2/M3 land. (M2/M3 shipped — refresh this spec.) |
| [`tests/e2e/onboarding-enterprise.spec.ts`](../tests/e2e/onboarding-enterprise.spec.ts) | 5 | Same as above. |
| [`tests/e2e/document-upload-and-validate.spec.ts`](../tests/e2e/document-upload-and-validate.spec.ts) | 5 | Expand once M3/M4 land. (Shipped — refresh.) |
| [`tests/e2e/offer-create-and-shortlist.spec.ts`](../tests/e2e/offer-create-and-shortlist.spec.ts) | 5 | Expand once M5/M6 land. (Shipped — refresh.) |
| [`supabase/policies.sql`](../supabase/policies.sql) | 7 | `scripts/apply-rls.ts` deployment helper not built. Apply via Supabase SQL editor manually. |

No `FIXME`, `XXX`, or `HACK` comments anywhere.

---

## 10. Open follow-ups requiring human action

| Item | Owner | Status / where |
|---|---|---|
| **Apply RLS SQL** | Francky | [`supabase/policies.sql`](../supabase/policies.sql) — paste into Supabase SQL editor; the auth bridge expects `request.jwt.claims` with `{ sub, role, user_id }`. No `scripts/apply-rls.ts` helper yet. |
| **Sentry DSN** | Francky | Set `SENTRY_DSN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` in CI). Code is wired conditional via [`next.config.mjs`](../next.config.mjs) — zero changes needed once env is set. |
| **Resend domain verification** | Francky | Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. `lib/resend.ts` no-ops when key absent. |
| **Meta API approval** | Francky | Set `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`. Stub mode is active in [`lib/social/meta-adapter.ts:41`](../lib/social/meta-adapter.ts) and `lib/social/types.ts:91` — drops messages silently until the env is populated. |
| **Video provider** | Decision | No provider integration; `Interview.videoUrl` is a free-text URL (Google Meet / Zoom / Jitsi all work). If you want native video, that's a new module — not in M1–M12 scope. |
| **MFA** | Francky | Enable in Clerk dashboard (per roadmap §7). No code change needed; Clerk MFA is dashboard-toggled. |
| **MG translations** | Translator | 101 `[MG-TODO]` strings in [`i18n/mg.json`](../i18n/mg.json). EN is fully translated; FR is the source. |
| **OneDrive build note** | (info only) | `next build` requires `outputFileTracing: false` locally because OneDrive renames files mid-trace. Vercel CI is unaffected. Documented in [`next.config.mjs`](../next.config.mjs). |
| **Refresh e2e specs** | Tester | The four playwright specs are stubs that compile but assert little. Expand now that M2–M7 are live. |
| **Contract ↔ code audit-key sync** | Francky | Section 5 lists 7 mismatches; recommend updating [`docs/contracts.md`](contracts.md) since code is shipped. |

---

Report complete.
