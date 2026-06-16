> ULTRACODE: implement at xhigh + workflows. Plan produced by the lead-orchestrated planning team (proposer→contrarian→moderator), auditor PASS, a red-team premortem (6 findings folded in), then an adversarial-verify gauntlet (2 build-breakers caught + patched: AuditLog.userId is required; the channel flag must gate at the parent, not via an in-component early return), 2026-06-15. Downstream executor: run at xhigh. Items 1, 3, 4, 7 are file-independent parallel slices; item 2 (GDPR) is one coupled atomic unit. SHIP IN TWO PRs: PR-A = items 1,2,3,4,7 (safe to deploy now); PR-B = item 5/6 (the env preflight), merged ONLY after Francky confirms all required prod vars (red-team #1 — the preflight would otherwise fail the very deploy that carries the batch).

# AsanaoConnect — Pre-Launch Hardening (7 engineering items)

## Goal & context

Pre-launch hardening for AsanaoConnect (repo: `projects/mgwork`; prod `mgwork-seven.vercel.app`). These 7 items are engineering-ownable and INDEPENDENT of Francky's account punch-list.

No AI surface is touched, so the Haiku-first model policy is not in play. Files stay <500 lines (hook-enforced); no new files beyond those listed; comments state only what code can't; YAGNI; validate at boundaries only.

**Out of scope here** (Francky's account/activation punch-list, not engineering): fund Anthropic, create Clerk prod instance, run Supabase bucket+RLS SQL, provision Upstash, set Vercel env vars, supply legal-entity data, Resend DNS, Meta App Review, Supabase PITR.

## Expectations / acceptance criteria

- `npm run build && npm test && npm run security:check` green before each commit; the 500-line hook passes on every touched file.
- Item 1 — distributed rate limiting works via Upstash when configured; falls back to in-memory on any Upstash failure; in production WITHOUT Upstash it emits a one-time cold-start degradation error (never silent, never hard-fails requests).
- Item 2 — `/candidate/profile` shows a GDPR card below the channels card; data export downloads JSON and is throttled to 3/hour (429 over limit); deletion-request returns 202 and writes a durable `auditLog` row + notifies the DPO.
- Item 3 — with `ENFORCE_LEGAL_ENTITY=true` the build throws on placeholder legal values; unset → build passes.
- Item 4 — Meta channel card hidden by default; visible only when `NEXT_PUBLIC_CHANNELS_ENABLED="true"`. Meta integration is NOT built.
- Item 5/6 — production deploy preflight (`scripts/check-env.mjs`) hard-fails on a missing required prod var when `VERCEL_ENV=production`; warn-only otherwise. `NEXT_PUBLIC_APP_URL` non-localhost check satisfies item 6. Ships as a SEPARATE gated PR-B — merged only after Francky confirms the required vars, so it cannot block PR-A's six fixes from deploying.
- Item 7 — zero direct `process.env` in `lib/csrf.ts`; all Vercel/app-URL reads go through `lib/config.ts` getters.

## Relevant files

| File | Role |
|---|---|
| `lib/config.ts` | Central env getters — add Upstash + Vercel + legacy app-URL getters (items 1, 7) |
| `lib/rate-limit.ts` | Rate limiter — add Upstash path + prod-degradation warning (item 1); currently 65 lines |
| `app/api/me/data-export/route.ts` | Pre-existing unthrottled export endpoint — add rate limit (item 2a) |
| `app/api/me/deletion-request/route.ts` | NEW — GDPR deletion-request endpoint (item 2b) |
| `app/candidate/profile/gdpr-card.tsx` | NEW — client GDPR card UI (item 2c) |
| `app/candidate/profile/page.tsx` | Render `<GdprCard />` below channels (2e) + parent-gate `<ChannelLinksCard />` behind the channel flag (item 4); `"use client"`, currently 471 lines |
| `lib/resend.ts` | Email sender — add `deletion-request` template enum + renderer (item 2b) |
| `i18n/en.json`, `i18n/fr.json`, `i18n/mg.json` | i18n strings for the GDPR card (item 2d) |
| `next.config.mjs` | NEW build guard for placeholder legal-entity values (item 3); currently 79 lines |
| `lib/legal-entity.ts` | Read-only target of the item-3 placeholder scan (not edited) |
| `app/candidate/profile/channel-links-card.tsx` | NOT modified — item 4 gates it at the parent (rules-of-hooks); listed for context only |
| `scripts/check-env.mjs` | NEW — env preflight gate (items 5/6) |
| `vercel.json` | Prepend preflight to `buildCommand` (items 5/6); `buildCommand` at L3 |
| `lib/csrf.ts` | Rebuild allowed-origins from config getters; remove direct `process.env` (item 7); currently 105 lines |

> i18n locale files are at `i18n/{en,fr,mg}.json` (verified). GDPR keys follow the existing `app.candidate.profile.*` + `[MG-TODO]` conventions.

## Targeted edits

### Item 1 — Distributed rate limiter `[independent]`

Goal: real cross-instance limiting via Upstash, graceful fallback, NO silent prod degradation.

1. `lib/config.ts` — add getters:
   - `upstashUrl: () => read("UPSTASH_REDIS_REST_URL")`
   - `upstashToken: () => read("UPSTASH_REDIS_REST_TOKEN")`
2. `lib/rate-limit.ts` (65 lines):
   - Keep ALL public signatures: `rateLimit`, `consume`, `_resetRateLimits`, `RateLimitResult`.
   - Keep the in-memory `Bucket`/`Map` path, renamed internally to `consumeLocal`.
   - `consume()` stays SYNC pointing at `consumeLocal` (direct callers depend on sync).
   - Add `async function consumeUpstash(bucketKey, capacity, windowMs)` using a raw `fetch` to the Upstash REST pipeline endpoint (NO new npm dependency):
     - `POST ${upstashUrl}/pipeline`
     - header `Authorization: Bearer ${upstashToken}`
     - body `[["INCR", key],["EXPIRE", key, ceil(windowMs/1000)]]`
     - `key = ${bucketKey}:${Math.floor(Date.now()/windowMs)}` (fixed window)
     - `signal: AbortSignal.timeout(500)` (MANDATORY — a cold/slow Upstash must never stall the lambda).
     - On any fetch throw / non-2xx → fall back to `consumeLocal` for that request.
   - `rateLimit()` decides the path PER CALL: `const useUpstash = !!(env.upstashUrl() && env.upstashToken())` (a cheap `process.env` read; computing it per-call rather than at module scope keeps the Upstash branch unit-testable without module reloads).
   - FOOTGUN FIX: when `process.env.VERCEL_ENV === "production"` AND Upstash vars are absent, emit a ONE-TIME cold-start `console.error("[rate-limit] PRODUCTION running without Upstash — per-lambda in-memory limiting only (not global)")`, guarded by a module-level `let warned = false`. Surfaces in Vercel logs and is captured by Sentry once its DSN is set. Do NOT hard-fail requests. Do NOT warn in dev/preview.
   - SEMANTIC NOTE: the Upstash path is fixed-window (INCR+EXPIRE), NOT the in-memory token-bucket — it permits up to ~2× burst at window boundaries. Acceptable for cost/abuse limiting; do not assume byte-identical behavior to `consumeLocal`.
   - Line-count target ~95. No new npm packages.
3. `tests/unit/rate-limit.test.ts` — add coverage for the Upstash path (red-team #2: today ONLY `consume`/`consumeLocal` is tested, so the branch that runs in prod once Upstash is live is unit-untested). Mock global `fetch` and set `UPSTASH_REDIS_REST_URL`+`_TOKEN`: (a) under-limit → `allowed:true`; (b) count > capacity → `allowed:false`; (c) `fetch` throws / aborts → falls back to `consumeLocal` (`allowed:true`). The per-call `useUpstash` (above) makes this testable without `jest.resetModules`.

### Item 2 — GDPR self-service `[ordered: build atomically as ONE coupled unit]`

Scope note: this is ONE coupled commit (2a+2b+2c+2d+2e + the `resend.ts` enum/renderer). It fixes a pre-existing unthrottled endpoint AND adds a net-new deletion-request feature — not mere wiring.

- **2a (PRE-EXISTING GAP — highest priority in this phase):** `app/api/me/data-export/route.ts` currently has `auth()` but NO rate limit (verified). Add `import { rateLimit } from "@/lib/rate-limit"` and, after the user lookup:
  ```ts
  if (!(await rateLimit(clerkUserId, "user.export", 3, 3600)))
    return new NextResponse("Too Many Requests", { status: 429 });
  ```
  (3 exports/hour.) NOTE (red-team #5): until Upstash (item 1) is provisioned, `rateLimit` is per-lambda in-memory, so this cap is per-instance defense-in-depth — strictly better than today's zero, but not a global hard limit until Upstash activates.
- **2b — NEW FILE `app/api/me/deletion-request/route.ts`:** POST only. Mirror the security shape of the erasure route:
  - Clerk `auth()` (401 if none).
  - `assertSameOrigin` / CSRF guard.
  - `rateLimit(clerkUserId, "deletion.request", 3, 86400)` (3/day anti-spam → 429).
  - Look up the user; create the DURABLE record via `auditLog.create({ data: { userId: user.id, action: "user.deletion_request", resourceType: "user", resourceId: user.id } })`. `userId` is REQUIRED on the AuditLog model (non-nullable, no default — `schema.prisma:311`; the route fails `tsc` without it — mirror the erasure route which always supplies it). `resourceId` is OPTIONAL. This is the authoritative record — security-check `missing-audit` requires it.
  - Notify the DPO via `send()` from `lib/resend.ts` to `LEGAL_ENTITY.email.dpo`. `send()` is template-enum-typed → add `"deletion-request"` to `EMAIL_TEMPLATES` in `lib/resend.ts` and register a minimal renderer (subject + body containing user id, email, timestamp) so it doesn't fall to the generic placeholder.
  - INSPECT the `send()` result (red-team #3): `send()` no-ops silently when `RESEND_API_KEY` is absent (`{error:"no-key"}`) and returns `{error:"send-error"}` on failure (`resend.ts:80-105`). On either, `console.error("[deletion-request] DPO email not delivered", { userId, result })` (Sentry-captured) so a dropped legal notification is visible to ops. STILL return 202 (don't leak infra state). The `auditLog` row is the durable fallback — admins find pending requests by filtering `app/admin/audit` for action `user.deletion_request` (the audit page has an action filter).
  - Return 202 `{ ok: true }`.
  - No Prisma model needed (`auditLog` is the durable record). Must pass security-check (auth + audit present).
- **2c — NEW FILE `app/candidate/profile/gdpr-card.tsx` (~80 lines):** `"use client"`, no props.
  - Button "export" → `fetch("/api/me/data-export")`; CHECK `res.ok` FIRST (red-team #4 — the 3/hour cap makes a 429 reachable): on `!res.ok` set `downloadError` and STOP; only on ok → blob → object-URL → click hidden `<a download>` (never save an error body as a `.json` file).
  - Button "request deletion" → POST `/api/me/deletion-request`, inline success/error.
  - States: `downloading` / `downloadError` / `requesting` / `requested` / `requestError`.
  - `useTranslations("app.candidate.profile.gdpr")`.
  - Use `Card` / `Button` / `Stack` from `@/components/mg` (match the profile-page idiom).
- **2d — i18n:** add `app.candidate.profile.gdpr.{title,subtitle,export,exportError,delete,deleteConfirm,deleteError}` to `en.json` + `fr.json` (real FR), and `mg.json` with `[MG-TODO]` + FR value (existing convention).
  - FR values:
    - `title` → "Vos données"
    - `subtitle` → "Téléchargez une copie ou demandez la suppression."
    - `export` → "Télécharger mes données"
    - `exportError` → "Échec du téléchargement"
    - `delete` → "Demander la suppression du compte"
    - `deleteConfirm` → "Votre demande de suppression a été reçue. Nous la traiterons sous 30 jours."
    - `deleteError` → "Échec — réessayez ou écrivez à privacy@mgwork.io"
  - EN: provide equivalents of each.
- **2e — `app/candidate/profile/page.tsx` (471 lines):** add `import GdprCard from "./gdpr-card";` (near the `ChannelLinksCard` import ~L14) and render `<GdprCard />` after `<ChannelLinksCard />` (~L358). 471 → ~473.

### Item 3 — Legal-entity placeholder build guard `[independent]`

NEW guard code (NOT mirroring an existing legal guard — the block at `next.config.mjs:34-44` is the Clerk `pk_test` guard).

1. Add static `import { readFileSync } from "fs"` at the top of `next.config.mjs`.
2. After the Clerk guard block, add:
   ```js
   if (process.env.ENFORCE_LEGAL_ENTITY === "true") {
     const legal = readFileSync(new URL("./lib/legal-entity.ts", import.meta.url), "utf8");
     if (legal.includes("__PLACEHOLDER_"))
       throw new Error("[mgwork] Refusing build: lib/legal-entity.ts still contains __PLACEHOLDER__ values while ENFORCE_LEGAL_ENTITY=true. Supply BRN, capital, director, address, incorporation date.");
   }
   ```
3. OFF by default (no env = no guard) so it can't brick deploys before Francky supplies data. 79 → ~91 lines.

CAVEAT (document it): do NOT set `ENFORCE_LEGAL_ENTITY=true` until the real legal values are in `lib/legal-entity.ts`, else every deploy fails.

### Item 4 — Meta channel feature flag `[independent]`

Decision LOCKED: hide the card, do NOT build the Meta integration.

Gate at the PARENT, NOT inside the component (adversarial-verify kill: `channel-links-card.tsx` calls 10 hooks unconditionally — `useTranslations` ×2, `useState` ×6, `useCallback`, `useEffect`, L41-73 — so an early `return null` inside it is a react-hooks/rules-of-hooks violation that fails lint/build).

1. `app/candidate/profile/page.tsx` (a `"use client"` component, verified L1) — change the render site (~L358) from `<ChannelLinksCard />` to:
   ```tsx
   {process.env.NEXT_PUBLIC_CHANNELS_ENABLED === "true" && <ChannelLinksCard />}
   ```
   `NEXT_PUBLIC_*` is build-inlined in the client bundle, so when unset this dead-code-eliminates the card. Flip the env to `"true"` in Vercel when Meta approves.
2. `channel-links-card.tsx` is NOT modified (no return-type change, no early return).
3. The `/api/me/channel-links` route stays (harmless — returns only the caller's own links); do NOT gate it.

### Item 5/6 — Env preflight gate `[SEPARATE PR-B — gated on Francky's env confirmation]`

Red-team #1: this is the ONE item that can BLOCK a deploy. `NEXT_PUBLIC_APP_URL` is required-tier and is currently on Francky's unset list, so wiring the preflight into `buildCommand` in the same PR as items 1–4,7 would make the prod deploy carrying the whole batch fail at step 1 — shipping nothing. Therefore this item ships in its OWN PR-B, merged only after the merge gate below passes.

1. NEW FILE `scripts/check-env.mjs` (~45 lines, plain Node, no `tsx`): hard-fail (exit 1) ONLY when `process.env.VERCEL_ENV === "production"`; warn-only in preview/dev/local (where `VERCEL_ENV` is unset).
   - REQUIRED-on-prod: `NEXT_PUBLIC_APP_URL` (set AND not containing `"localhost"`), `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - WARN-tier (never fails): `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
   - The `NEXT_PUBLIC_APP_URL` non-localhost check satisfies item 6.
2. `vercel.json` (`buildCommand` at L3): change `"npx prisma migrate deploy && npm run build"` → `"node scripts/check-env.mjs && npx prisma migrate deploy && npm run build"` (preflight runs FIRST).

PR-B MERGE GATE (pre-merge tripwire): before merging, prove the script would pass with the real prod values — `VERCEL_ENV=production NEXT_PUBLIC_APP_URL=<prod> CRON_SECRET=... [all required] node scripts/check-env.mjs` must exit 0. Merge PR-B ONLY once Francky confirms every required var is set in Vercel Production.
FALLBACK if it must land before vars are confirmed: ship the script WARN-only (log, never `exit 1`), then flip to hard-fail in a one-line follow-up once vars are green — never block the batch on an unconfirmed env.

### Item 7 — VERCEL_* config getters `[independent]`

Convention alignment (security-check's `process-env-outside-lib` rule already EXCLUDES `lib/` files, so this is the "no process.env outside config.ts" convention, not a security fix — still correct to do).

1. `lib/config.ts` — add getters:
   - `vercelUrl: () => read("VERCEL_URL")`
   - `vercelBranchUrl: () => read("VERCEL_BRANCH_URL")`
   - `vercelProjectProductionUrl: () => read("VERCEL_PROJECT_PRODUCTION_URL")`
   - `appUrlLegacy: () => read("APP_URL")`
2. `lib/csrf.ts` (105 lines):
   - Remove `APP_URL_ENV_KEYS` (L14-27) and its loop.
   - Rewrite `getAllowedOrigins()` to build the set from `env.appUrl()`, `env.appUrlLegacy()`, `env.vercelUrl() ? https://${...} : undefined`, `env.vercelBranchUrl()`, `env.vercelProjectProductionUrl()`, normalizing each to a URL origin (try/catch ignore on parse fail).
   - Keep the dev-only localhost additions but gate them on `env.nodeEnv() !== "production"`.
   - Replace ALL remaining `process.env.NODE_ENV` reads (`csrf.ts` L43 + L66, verified) with the EXISTING `env.nodeEnv()` getter (or `isProduction()`/`isDev()` helpers at `config.ts:57/61) — these already exist, do NOT re-add them. This is what makes the zero-`process.env` promise literally hold (adversarial-verify carry-over).
   - Result: zero direct `process.env` in `csrf.ts`. ~95 lines.

## Risks / edge cases / ordering

- **Items are file-disjoint and independent EXCEPT item 2** — items 1, 3, 4, 5/6, 7 can be fanned out as parallel workflow slices; item 2 (2a–2e + resend) is one coupled, atomic unit.
- **Item 1:** `AbortSignal.timeout(500)` is mandatory or a slow Upstash stalls the request path; the prod-degradation cold-start error is mandatory (no silent footgun).
- **Item 2a is the genuine pre-existing vulnerability** — treat as the top priority in this phase.
- **Item 2b will not typecheck** unless `"deletion-request"` is added to `EMAIL_TEMPLATES`; security-check fails the route without `auth()` + `auditLog.create`.
- **Item 3 guard MUST stay OFF (unset)** until real legal data lands, else it blocks every deploy.
- **Item 5:** do NOT promote Upstash to required-on-prod (it would block the next deploy before provisioning); keep it warn-tier.
- **Preflight deploy-block (red-team #1, HIGHEST):** the preflight ships as gated PR-B, never bundled with PR-A — bundling it would fail the batch deploy on `NEXT_PUBLIC_APP_URL`.
- **Untested prod limiter (red-team #2):** `npm test` covers only the in-memory path; the Upstash branch needs the mocked-`fetch` test added in item 1, or prod runs unverified rate-limiting code.
- **GDPR notification can no-op (red-team #3):** the DPO email silently no-ops without `RESEND_API_KEY`; the route must log on `no-key`/`send-error` and rely on the `auditLog` + `admin/audit` action filter as the durable fallback.
- **Export error body (red-team #4):** the GDPR card must gate on `res.ok` before writing the blob, or a 429 is saved as a `.json` download.
- **AuditLog.userId required (adversarial-verify):** item 2b's `auditLog.create` MUST pass `userId` (non-nullable, no default — `schema.prisma:311`) or the route fails `tsc`; `resourceId` is optional.
- **Channel flag must gate at the parent (adversarial-verify):** an early `return null` inside `channel-links-card.tsx` (10 unconditional hooks) is a rules-of-hooks violation — gate in `page.tsx` instead (item 4).

### Commit plan (atomicity) — TWO PRs

**PR-A (safe to deploy now — items 1,2,3,4,7), one commit each, any order:**
1. rate-limiter + Upstash test (item 1)
2. GDPR — 2a+2b+2c+2d+2e + the `resend.ts` enum/renderer as ONE coupled commit (item 2)
3. legal guard, OFF by default (item 3)
4. channel flag (item 4)
5. csrf getters (item 7)

**PR-B (gated — item 5/6), merged ONLY after the PR-B merge gate passes:**
6. preflight `scripts/check-env.mjs` + `vercel.json` buildCommand (items 5/6)

Every PR-A item is deploy-safe with Francky's env as-is: item 1 degrades gracefully, item 2's limits fall back to in-memory, item 3 is off by default, item 4 hides by default, item 7 is a pure refactor. None require a var that isn't already set for the running prod site.

### Line-count watch (cap 500)

| File | Before → After |
|---|---|
| `rate-limit.ts` | 65 → ~95 |
| `next.config.mjs` | 79 → ~91 |
| `csrf.ts` | 105 → ~95 |
| `profile/page.tsx` | 471 → ~473 |
| `channel-links-card.tsx` | 219 → 219 (NOT modified — gated at parent) |
| new files (`deletion-request/route.ts`, `gdpr-card.tsx`, `check-env.mjs`) | all <100 |

All under the 500-line cap.

## Verification

End-to-end gate before each commit: `npm run build && npm test && npm run security:check` green; the 500-line hook passes on every touched file.

Per-item probes:

- **Item 1:** `npm test` includes the new Upstash-path tests (under-limit / over-limit / timeout→fallback, mocked `fetch`); unset Upstash → in-memory works; set fake Upstash + force fetch error → falls back; with `VERCEL_ENV=production` + no Upstash → cold-start `console.error` fires once.
- **Item 2:** `/candidate/profile` shows the GDPR card below channels; export downloads JSON on `res.ok`, shows `exportError` on a forced 429 (no `.json` error-body download); deletion-request returns 202 + success copy + an `auditLog` row written; with `RESEND_API_KEY` unset the route logs the no-delivery error AND still 202s + still writes the audit row; data-export over 3/hour returns 429.
- **Item 3:** `ENFORCE_LEGAL_ENTITY=true` → build throws on placeholders; unset → build passes.
- **Item 4:** `npm run build` + lint clean (NO react-hooks/rules-of-hooks error); env unset → card absent; `NEXT_PUBLIC_CHANNELS_ENABLED="true"` → card visible; `channel-links-card.tsx` shows no diff.
- **Item 5/6 (PR-B):** `VERCEL_ENV=production` + a missing required var → `node scripts/check-env.mjs` exits 1; with ALL required vars set → exits 0 (this is the PR-B merge gate); unset `VERCEL_ENV` → exits 0 (warn only).
- **Item 7:** `grep process\.env\.VERCEL lib/csrf.ts` → zero matches; `security:check` clean.

## Downstream Francky dependencies (activation, not build)

These do not block the build/commit; they activate behavior after the code lands:

- Upstash provisioning activates item 1's distributed path (until then prod logs the degraded warning).
- `ENFORCE_LEGAL_ENTITY=true` only after legal data is supplied in `lib/legal-entity.ts`.
- `NEXT_PUBLIC_CHANNELS_ENABLED=true` when Meta approves.
- All preflight REQUIRED vars must be set in Vercel Production (the preflight enforces this on the next deploy).

## Open questions / out of scope

- **Out of scope (Francky's account/activation punch-list):** fund Anthropic, create Clerk prod instance, run Supabase bucket+RLS SQL, provision Upstash, set Vercel env vars, supply legal-entity data, Resend DNS, Meta App Review, Supabase PITR.
- No AI surface is touched → Haiku-first model policy not in play.
- **Deferred tripwire (red-team #6):** `security-check.ts` has no missing-ratelimit rule, so the data-export class of bug (a sensitive route shipping unthrottled) can recur. Add a heuristic (non-GET / sensitive route without a `rateLimit(` call → warn) in a later hardening pass — not in this batch.
- **Deferred (red-team #3 follow-up):** a dedicated `app/admin` "pending deletion requests" queue/view (vs the current audit-filter workaround) if deletion volume warrants it.
- All anchors lead-verified against live code; the 6 red-team findings are folded in above.
