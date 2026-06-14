---
ULTRACODE: implement at xhigh + workflows. This plan was produced by the 6-role planning team
(proposer→contrarian→moderator, 2 rounds, converged) over a judge-panel audit, all anchors
re-verified against live code. On implementation, copy this file to
projects/mgwork/docs/plans/2026-06-14-dashboard-ui-fixes.md.
---

# AsanaoConnect — Dashboard remediation (7 issues, 2 sprints)

## Context

After the AsanaoConnect batch shipped (`3e2918f`), Francky reported 7 dashboard issues. A judge-panel audit (winner: systemic angle, 3-0) diagnosed them; the planning team then debated and hardened the fix plan. Four of the seven (2, 5, 6, 7) concentrate in one 494-line server component, `app/enterprise/page.tsx`. Deliverable of this plan = an implementation-ready spec; the team did NOT edit code. No AI surface is touched, so the Haiku-first model policy is not in play. Nothing here may regress `3e2918f`.

**Decisions locked (lead + user, 2026-06-14):**
- Issue 6 display → **empty-state** on accounts with no real applications (stop rendering fabricated candidates).
- Issue 6 scope → **Path A now** (remove dead controls); Path B (real preselect/skip) deferred to its own ticket.
- Issue 3 fonts → **Track A only** (purge dashboard 11px); Track B global token bump deferred (design-gated).
- Stacked layout (<xl) → **feed-first** (rail below the match feed).
- `components/staff/StatusBadge.tsx` → **localize in place** (don't merge into the mg badge now).
- MG locale → **fall back to FR** with `[MG-TODO]` markers (v1 convention; MG hidden in switcher).

**Team-verified corrections to the audit (don't reintroduce):** there is NO `[locale]` route segment (locale is the `mgwork_lang` cookie — all real paths are `app/enterprise/…`, `app/admin/…`); there are **11** unthreaded mg-`StatusBadge` sites, not 9; each page scopes its `t` to a different namespace, so status threading needs a dedicated `getTranslations("status")` per site or every lookup misses; the mg `StatusBadge` already has an optional `label` and a safe French fallback, so the live symptom is "French on EN," not raw keys; `enterprise/page.tsx` is 494 lines (cap is 500 — watch it).

---

## Sprint 1 — quick wins (S, low regression)

**S1-1 Language menu drop-up.** [components/mg/language-menu.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/language-menu.tsx) — add `placement?: "up" | "down"` **to the `LanguageMenuProps` interface (L12-14, currently only `className?`)** and destructure it with default `"down"`. Without the interface field, `<LanguageMenu placement="up" />` (S1-2) fails `tsc` and breaks the build. In the open `<div role="listbox">` style (L88-99) branch `placement === "up" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }`, keep `right: 0`. Positioning is inline, so a className can't do this.
**S1-2** [components/mg/web-sidebar.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/web-sidebar.tsx) L194 → `<LanguageMenu placement="up" />` (only caller needing up-flip; 3 other callers keep the default).

**S1-3 Theme-toggle aria-label i18n** (fixes a11y in the already-shipped desktop sidebar too). [components/mg/theme-toggle.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/theme-toggle.tsx) L30-31 — replace the hardcoded French `aria-label`/`title` with `useTranslations` lookups (`themeToggle.toLight`/`toDark`); add `import { useTranslations } from "next-intl"` (the file imports nothing from next-intl today). Already `"use client"`.
**S1-7 keys** [i18n/{fr,en,mg}.json](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/i18n) — add `themeToggle.toLight`/`toDark` (+ short variants if used); fr primary, en, mg=fr value with an MG-TODO note in the PR. Keys are net-new (grep-confirmed).

**S1-4 Mobile dark mode (mobile-shell).** [components/mg/mobile-shell.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/mobile-shell.tsx) — add `import { ThemeToggle } from "./theme-toggle"`; insert a flex row (space-between, marginTop 8) in the drawer before the logout button (~L191) containing **only** `<ThemeToggle />` (LanguageMenu is already in the top bar at L102 — do not duplicate).
**S1-5 Mobile dark mode (candidate chrome).** [components/mg/cand-mobile-chrome.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/cand-mobile-chrome.tsx) — imports NEITHER toggle; add both `LanguageMenu` and `ThemeToggle`; insert the same flex row before the logout button (~L152). Verify the drawer row sits above the fixed `CandTabBar` (L177, zIndex must stay under the drawer's 50).

**S1-6 Enterprise responsive grids.** [app/enterprise/page.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/app/enterprise/page.tsx) — KPI grid L256 → `className="grid grid-cols-2 xl:grid-cols-4 gap-4"`; matches/rail grid L280 → `className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6"` (drop the inline grid styles). `xl` (1280), not `lg` — the 248px sidebar leaves ~776px at 1024px. Matches the admin precedent ([app/admin/page.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/app/admin/page.tsx) L83). Rail stacks below the feed (feed-first, locked).

**S1-8 Perf — batch the interview count.** app/enterprise/page.tsx — `prisma.interview.count` (L185-190) runs serially after the `Promise.all` because it needs `weekStart`, which is currently element [1] of that batch (`Promise.resolve(startOfThisWeek())`, L161). Fix: **hoist `const weekStart = startOfThisWeek();` ABOVE the `Promise.all`** (delete the L161 `Promise.resolve(...)` element), then add `prisma.interview.count({ where: { …, scheduledAt: { gte: weekStart } } })` as a batch element and destructure it. Do NOT reference the destructured `weekStart` binding from inside the same `Promise.all` — that is a temporal-dead-zone bug (it's unassigned until the batch resolves); the hoist is what makes it safe. `startOfThisWeek()` is synchronous, so hoisting is free.

**S1-9 Issue 6 — empty-state + remove dead controls (Path A). Applied as ONE atomic edit with S1-8** (both touch the same `Promise.all`):
- Initialize `let matches: MatchRow[] = []` and populate ONLY from real `recentApps`; **delete the `PLACEHOLDER_MATCHES` constant** (L50-117, now dead code). The existing `matches.length === 0` branch (L314-320) renders the real empty-state (`matches.empty`, key present at fr.json ~L1102).
- **Remove the Skip `<Button>`** (L361-363) entirely — no handler, Path A doesn't build the feature (re-add in Path B). **Also delete the now-orphaned `matches.skipButton` key from BOTH fr.json and en.json (~L1105)** or `scripts/i18n-residual.mjs` flags it.
- Replace hardcoded `presetUsed = 3` (L223) with a real `prisma.application.count` (SHORTLISTED) — included in the tuple below. `presetLimit` stays `5` as the documented v1 default (real source deferred to Path B) — note it inline so it isn't read as a second fabricated number.
- "View profile" already guards on `matchesAreReal` (L364-375) and works on real accounts — leave it.
- **Exact resulting batch (S1-8 hoist + S1-9 counts together — adopt verbatim, no half-edited commit):**
```ts
const weekStart = startOfThisWeek();                 // hoisted ABOVE the batch (sync, free)
const [applicationsAgg, quota, recentApps, docs, interviewsThisWeek, presetUsed] =
  await Promise.all([
    prisma.application.count({ where: { jobOffer: { enterpriseId: enterprise.id } } }),
    getOfferQuota(enterprise.id),
    prisma.application.findMany({ /* take 6, existing select */ }),
    prisma.document.findMany({ where: { enterpriseId: enterprise.id }, select: { status: true, expiresAt: true } }),
    prisma.interview.count({ where: { application: { jobOffer: { enterpriseId: enterprise.id } }, scheduledAt: { gte: weekStart } } }),
    prisma.application.count({ where: { status: "SHORTLISTED", jobOffer: { enterpriseId: enterprise.id } } }),
  ]);
```

**Sprint 1 atomicity:** S1-1+S1-2 one commit; S1-3+S1-7 one commit (theme i18n end-to-end); S1-6 standalone; **S1-8 + S1-9 are ONE atomic edit** to enterprise/page.tsx (hoist + both new batch elements + empty-state + Skip removal land together — never commit the half-hoisted batch). enterprise/page.tsx 493 → ~427 lines after S1-9 (PLACEHOLDER_MATCHES deletion); re-count (hook-enforced).

---

## Sprint 2 — i18n + fonts + perf (M)

**S2-1 status namespace.** [i18n/{fr,en,mg}.json] — add a flat `status.*` namespace covering all 23 `StatusKey`s (status-badge.tsx L7-30). fr = the existing French defaults from `STATUS_TONE` (L34-57); en = English; mg = fr fallback. All 23 required in fr+en before ship.

**S2-2 statusLabel helper.** [components/mg/status-badge.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/status-badge.tsx) + barrel [components/mg/index.ts](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/mg/index.ts) — add a pure helper:
```
export function statusLabel(status, tStatus) {
  const v = tStatus(status);            // next-intl v4 returns the raw key on a miss
  return v === status ? defaultFor(status) : v;   // defaultFor = French default from STATUS_TONE
}
```
SIMPLIFY to just `return tStatus(status);` — the miss-guard is dead code: EN/MG messages are `deepMerge(FR_baseline, locale)` (lib/i18n.ts NESTED_MESSAGES L142-148), so a missing key resolves to the FR value, NEVER the raw key, so `v === status` can never fire. (The earlier "returns raw key, verified L70" rationale was wrong — L70 is the legacy flat `tFor`, a different path.) No try/catch, no `t.has`, no STATUS_TONE re-lookup. `tStatus` MUST be a `"status"`-scoped translator. Correctness now rests entirely on S2-1 authoring all 23 EN keys — the residual check (verification) is the guard. If next-intl's scoped translator type rejects a `string` key, cast at the call (confirm at build).

**S2-3 Thread the mg-StatusBadge sites (10 instances across 9 files).** Each adds `const tStatus = await getTranslations("status")` near its existing `getTranslations` call and passes `label={statusLabel(<status>, tStatus)}`:
app/enterprise/page.tsx L348 + L467 · app/enterprise/offers/page.tsx L217 · app/enterprise/interviews/page.tsx L215 · app/candidate/page.tsx L283 · app/candidate/applications/page.tsx L124 · app/staff/followup/page.tsx L240 · app/staff/documents/page.tsx L332 · app/admin/invoices/page.tsx L220 · app/admin/disputes/page.tsx L272. (app/staff/page.tsx L70-81 already threads label — leave it.) **Re-grep `<StatusBadge` immediately before editing** to re-anchor line numbers (OneDrive drift).

**S2-4 Localize the staff badge in place.** [components/staff/StatusBadge.tsx](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/components/staff/StatusBadge.tsx) — `checkpointStatusLabel` (L57-66) and `DocumentStatusBadge` (L87-88) compute the label from `status.*` keys (reuse S2-1; the 4 DocumentStatus + 3 CheckpointStatus values are already in the 23) and pass it down via the base badge's `label`. Update call sites in the same commit: app/staff/documents/[id]/page.tsx L115, app/staff/followup/[applicationId]/page.tsx L197. (NOTE: QueueRow.tsx L57 is the **mg** `StatusBadge` with a hardcoded `label="Priority"` — NOT a staff-badge call site; drop it from S2-4 scope and file that one hardcoded string as a separate i18n follow-up.)

**S2-5 Sector labels.** **Lift `QUICK_SECTORS` to a shared module** — it's a private const in candidates/page.tsx L65-71 today; export it (e.g. `lib/sectors.ts`) so both the page and helper import it. Add `sectorLabel(sector, tEnt)` = `QUICK_SECTORS.find(q => q.value === sector)?.labelKey` → `tEnt(labelKey)`, passing free-text through verbatim on a miss. **Do NOT hand-roll a slugifier/accent-stripper** (none exists in lib/; values like "Hôtellerie"/"Santé" make NFD bug-prone — match the table by exact value). In the page add `const tEnt = await getTranslations("app.enterprise")` (NOT the dashboard-scoped `t` at L122 — the quickSector keys live under `app.enterprise`, fr.json ~L1069-1073) and replace `<Badge>{m.sector}</Badge>` (L347) with `{sectorLabel(m.sector, tEnt)}`.

**S2-6 Font Track A** (dashboard surfaces only; bump inline 11px / `text-[11px]` → 13px). **CRITICAL: `.mg-caption` sets size only, `.mg-mono` sets font-family only (orthogonal in globals.css) — on a MONOSPACE element use BOTH `className="mg-mono mg-caption"`; bare `mg-caption` would silently strip monospace and break table alignment.** Sites: app/staff/documents/page.tsx L315 · app/enterprise/offers/[id]/page.tsx L238 · app/admin/users/page.tsx L230 (mono → `mg-mono mg-caption`) · app/admin/invoices/page.tsx L217 (mono → `mg-mono mg-caption`) · components/mg/web-sidebar.tsx L177 email (mono → `mg-mono mg-caption`; existing ellipsis makes the combo safe). For app/admin/audit/page.tsx: the L183/208/214/223 spans are `mg-mono` → `mg-mono mg-caption`; the **L226-236 block is a separate `<pre>` with its OWN inline `fontFamily`** (NOT an mg-mono span) → bump its inline `fontSize` to 13 directly. EXCLUDE the 2 public files. Re-verify audit log-table alignment after.

**S2-7 Suspense streaming.** app/enterprise/page.tsx — extract the plan+KYC rail (L385-480) into a new async component file (e.g. `components/mg/enterprise-plan-kyc-rail.tsx`), wrap its mount in `<Suspense fallback={<skeleton/>}>`, add [app/enterprise/loading.tsx]. The extracted file re-establishes `getTranslations("app.enterprise.dashboard")` (rail uses `plan.*`/`kyc.*`) and takes the computed inputs as props. Extract the RAIL (the data/async seam) — NOT `PLACEHOLDER_MATCHES`. **Re-count both files <500 after.** Skeleton uses the same `xl` breakpoint.

**S2-8 Cache matching weights (ship as ONE commit).** [lib/matching-config.ts](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/lib/matching-config.ts) — wrap `getMatchingWeights` (L38) in `unstable_cache(…, ["matching-weights"], { tags: ["matching-config"] })` (global singleton, no per-user data — safe). [app/api/admin/matching-config/route.ts](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/app/api/admin/matching-config/route.ts) — after `setMatchingWeights` (L137) call `revalidateTag("matching-config")`. Add the `next/cache` imports both places (`unstable_cache` in matching-config.ts, `revalidateTag` in the route). Never split these two commits — splitting ships a stale-weights bug.

**Sprint 2 atomicity:** S2-1 first (keys) → S2-2+S2-3 (helper + mg threading) → S2-4 (staff badge + 3 call sites) → S2-5 (sector) → S2-6 (font) → S2-7 (Suspense + line re-count) → S2-8 (cache+invalidation together).

---

## Deferred (out of scope; separate tickets)

- **Issue 6 Path B** — real preselect/skip: a client island, new `PATCH /api/enterprise/applications/[id]/status`, SHORTLISTED/REJECTED transitions, server-side quota (`getPreselectionQuota` does not exist), and a consent/notification model honoring decision G (REVEAL_STATUSES keeps SHORTLISTED masked).
- **Issue 3 Track B** — global type-token bump (cascades to marketing; needs design QA).
- **Issue 7** — force-dynamic audit across the 29 routes (per-route PII-boundary review required) and Next PPR.

---

## Risks / ordering

- **Highest risk:** S2-8 shipped without the paired `revalidateTag` serves stale weights for the full TTL — keep it one commit.
- **Silent-French regression:** a missed StatusBadge site shows French with no type error — rely on the i18n-residual script + the locale probe below; re-grep before S2-3.
- **500-line cap (hook-enforced):** re-count `enterprise/page.tsx` after S1-9 (deleting PLACEHOLDER_MATCHES helps) and after S2-7 (extraction must drop it well under 400; new rail file <500).
- **PII:** S2-8 caches only the global weights row — do not extend caching to any candidate-bearing query.

## Verification (end-to-end)

- **Gate:** `npm run build && npm test` green before each commit; 500-line hook passes on every touched file.
- **Issue 1:** Playwright — open the sidebar `LanguageMenu`, assert listbox `bottom <= trigger.top` and in-viewport; public header still opens downward.
- **Issue 2:** Clerk-login `test_enterprise` (123456789), `mgwork_lang=EN`, sweep dashboard/offers/interviews/staff/admin — assert no badge text equals a French `STATUS_TONE` default and none equals a raw `status.*` key; MG → asserts FR fallback. Unit-test `statusLabel`/`sectorLabel` (hit/miss/unknown) in [tests/unit/i18n.test.ts](../../OneDrive/EXECUTIVE%20ASISTANT/projects/mgwork/tests/unit/i18n.test.ts); run `scripts/i18n-residual.mjs` for the 23 keys.
- **Issue 3:** computed `font-size` on dashboard caption/body ≥13/14px; grep asserts zero `fontSize:11`/`text-[11px]` under dashboard surfaces; marketing spot-check unchanged.
- **Issue 4:** at <lg open both drawers — ThemeToggle present, toggles light/dark, `aria-label` localized.
- **Issue 5:** computed `grid-template-columns` = 2 tracks at 1024px, 4 at 1280px; no horizontal scroll.
- **Issue 6:** empty account → `matches.empty` shown, NO fabricated candidates, no Skip button, counter not "3/5"; real account → View Profile resolves (no 404).
- **Issue 7:** `interview.count` inside `Promise.all` (inspection); Suspense skeleton paints before the rail (throttled); after an admin weights save a subsequent read reflects the new value (revalidateTag fired).
