# AsanaoConnect — Production-readiness audit, 2026-06-11

- **Date:** 2026-06-11
- **Commit:** `5aed57a` — AsanaoConnect batch (rebrand, Haiku-first AI policy, candidate memory + enterprise chat, post-signup language test, doc detection, channels P0, disputes attachments, font + tab-title fixes)
- **Prod URL:** https://mgwork-seven.vercel.app
- **Auditor:** live Playwright audit post-deploy (real Chrome via extension mode; roles: candidate `test_user@`, enterprise `test_enterprise@`, admin `test_admin@`, staff `test_documents@`)

## Static gates (CI-equivalent for this batch)

| Gate | Result |
|---|---|
| `npm run build` | green |
| typecheck | green |
| Tests | 20 suites / 249 tests green |
| `prisma validate` | green |
| Migration `20260611000000_ai_platform_channels` | auto-applied by the successful Vercel deploy (present in `prisma/migrations/`) |

## Live matrix

| Area | Result | Evidence |
|---|---|---|
| Public: home renders | PASS | Hero + title render, 0 console errors |
| Public: branding rebrand | **FAIL** | Header + footer wordmark still "MG·Work" on every page (`components/mg/wordmark.tsx` never rebranded); footer "© 2026 MG·Work SARL" (`i18n/{fr,en}.json:216`); Clerk box says "pour continuer vers mgwork". Tab titles + cookie/privacy page titles correctly "AsanaoConnect" |
| Public: FR↔EN switch | PASS | `html[lang]` en↔fr, hero flips ("Labour mobility…" ↔ "La mobilité du travail…"), tab title flips both directions |
| Candidate: dashboard | PASS | `/candidate` loads (no 500 — new AI/channels columns OK); language-test card, matches, docs cards render |
| Candidate: fonts | PASS | getComputedStyle: body 16px, card primary text 14px, secondary/captions 13px, sidebar 14px — no 12px anywhere sampled |
| Candidate: authed lang switch | PASS | Content flips AND tab title flips "Candidate area" ↔ "Espace candidat" (generateMetadata works) |
| Candidate: /candidate/chat | **FAIL (ungraceful degrade)** | Page loads, send works, no crash — but raw Anthropic 400 JSON rendered verbatim in chat (see defects D1/D2) |
| Candidate: /candidate/language-test | PASS | Flow UI renders: choose Français/Anglais, "4 questions courtes… notées par IA sur 100" |
| Candidate: profile channels card | PASS | "Canaux connectés" card with WhatsApp/Messenger/Instagram + "Générer un code de connexion"; empty state correct |
| Candidate: mobile 390x844 | PASS | No horizontal scroll (scrollWidth 375), bottom tab nav (5 items, 64px) visible, dashboard content renders |
| Enterprise: dashboard | PASS | "Vue d'ensemble" / "Matchs récents" / "Documents KYC" render |
| Enterprise: /enterprise/chat | **FAIL (ungraceful degrade)** | Page exists ("Assistant IA"), send works, no crash — same raw 400 JSON leak as candidate chat |
| Enterprise: offers + interviews fonts | PASS | Both render; zero text elements under 13px |
| Admin: /admin/disputes loads | PASS | Kanban renders (Ouverts / En cours / Résolus) |
| Admin: disputes "+ Add" dialog | NOT TESTABLE LIVE | 0 dispute rows in prod → per-card attachments cell never renders. API is deployed: authed `GET /api/admin/disputes/{id}/attachments` → clean `404 {"ok":false,"error":{"code":"NOT_FOUND"}}`. Upload itself remains EXPECTED-DEGRADED until bucket SQL is applied |
| Admin: attachment count/list UI | PASS (code-verified) | `app/admin/disputes/attachments.tsx` wired into every card (`page.tsx:276`); not visible live only because board is empty |
| Staff: documents review | PASS | `/staff/documents` (test_documents@, STAFF_DOCUMENTS) loads queue (1 pending passport, 36 j); no errors with aiAnalysis absent |

## New defects found live

- **D1 — Chat leaks raw provider errors (candidate + enterprise).** `/api/chat` returns 200 with SSE `event: error`, `code: EXTERNAL_DEPENDENCY_FAILED`, whose `message` embeds the raw upstream body (`400 {"type":"error"…"request_id":"req_…"}`); the client renders it verbatim. Repro: log in, open chat, send any message. Fix: map `EXTERNAL_DEPENDENCY_FAILED` to a localized "assistant unavailable" string client-side AND stop passing the upstream body through server-side.
- **D2 — ANTHROPIC_API_KEY is actually SET in Vercel, account unfunded.** The live error is `invalid_request_error: Your credit balance is too low` — that only occurs with a valid key. The blocking item is **funding/billing on the Anthropic account** (or replacing the key), not setting the env var.
- **D3 — Logout button is a no-op in the authed web sidebar (all roles).** Clicked "Se déconnecter" 3x as candidate and again as admin: zero Clerk sign-out network calls, `Clerk.session` stays active. Repro: log in, click the sidebar logout icon, reload — still signed in. Worked around via `Clerk.signOut()` in console.
- **D4 — Rebrand misses the brand wordmark.** `components/mg/wordmark.tsx` still renders "MG·Work" — shown in the public header, footer, and every authed sidebar. Also `marketing.footer.copyright` + `mentions.metaDescription` in `i18n/{fr,en}.json` ("MG·Work SARL" may be the legal entity — confirm intent), and the Clerk application name ("continue to mgwork").
- **D5 — Clerk is a Development instance in prod.** `joint-pony-17.clerk.accounts.dev`, visible "Development mode" badge + console warning about strict usage limits. Must move to a Clerk production instance (with the new domain) before real users.
- **D6 — Privacy page shows literal `__PLACEHOLDER_ADDRESS_PORT_LOUIS__`** (`/legal/confidentialite`, Data-controller section). Pre-existing, but it is public legal copy.
- **D7 (minor, pre-existing) — "Nouveau dossier" button on /admin/disputes has no handler** (decorative server-component button, `page.tsx:149`).
- Note: Vercel Attack Challenge Mode 403s RSC prefetches (`?_rsc=`) in console — cosmetic, navigations succeed; known mode behavior.

## Necessary steps to production (ranked)

**BLOCKING**
1. **Anthropic API billing** — key is present but the account has no credit (D2). Fund the account or swap the key (user action). All AI features (chat, doc analysis, language-test grading) are dormant until then.
2. **Supabase bucket SQL** — run `supabase/buckets_2026-06-11_disputes_avatars.sql` manually (user action). Disputes attachments upload + avatar upload fail until applied.
3. **Clerk production instance** (D5) — dev instances have hard usage limits; not viable for launch.

**IMPORTANT**
4. Fix chat error-state mapping (D1) before the API key goes live — currently leaks provider internals to end users.
5. Fix sidebar logout (D3) — users cannot sign out.
6. Finish the wordmark/copyright rebrand (D4) and replace the Port-Louis placeholder address (D6).
7. Distributed rate limiting — `lib/rate-limit.ts` is process-local; Upstash planned. Cost-abuse exposure the moment the API key is funded.
8. Meta channel envs + WABA setup + Meta App Review (2–6 weeks lead) before WhatsApp/Messenger go live.
9. Doc-analysis covers JPEG/PNG only (PDF/DOCX skipped) — set expectations or extend.
10. Domain migration mgwork.io → AsanaoConnect domain (deliberately deferred; emails dpo@/privacy@mgwork.io still referenced in legal pages).
11. MG locale hidden pending professional translations (switcher correctly shows FR/EN only).

**NICE-TO-HAVE**
12. Seed at least one demo dispute in prod so the attachments UI is exercisable end-to-end after the bucket SQL lands.
13. Silence the `afterSignInUrl` Clerk deprecation warning.
14. Secondary card captions sit at 13px — fine, but bumping to 14px would fully align with the typography pass.

## Post-audit fixes (shipped same day, follow-up commit)

- **D1 fixed** — `/api/chat` no longer forwards upstream bodies: both SSE error paths now send localized safe copy (`safeChatError`, FR/EN; MG→FR); details stay in the audit row + server log.
- **D3 fixed** — sidebar logout was a three-dot menu whose *toggle* carried the logout label; replaced with a direct one-click sign-out button (`sidebar-actions-menu.tsx`, new `log-out` icon).
- **D4 partially fixed** — `wordmark.tsx` now renders "AsanaoConnect" (two-tone). Left as-is on purpose: footer copyright "© 2026 MG·Work SARL" (legal entity, per rebrand decision) and the Clerk app name "mgwork" (Clerk dashboard setting — user action, pairs with D5).
- Still open for the user: D2 (fund Anthropic account), D5 (Clerk production instance), D6 (real Port-Louis address), bucket SQL.
