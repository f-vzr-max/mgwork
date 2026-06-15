---
ULTRACODE: implement at xhigh + workflows. Produced by the 6-role planning team
(proposer→contrarian→moderator, 2 rounds, converged) over two /deliberate passes,
then red-teamed (7 findings) and patched via judge-panel. All anchors verified
against live code. Branch off main for implementation.
---

# Candidate-area UI phase — full-width reflow + toggleable chat drawer + lang-menu align + enterprise candidates mobile fix

## Context

Francky reported candidate-area UX problems across two /deliberate passes: the candidate dashboard is a centered ~720px mobile column with huge side gutters; the sidebar language menu overflows off the left edge; the candidate chat is a full-page route with a full-width composer (wants a modern toggleable drawer); and the enterprise candidates page is broken on mobile (the "Appliquer" button overflows). This plan covers all of it. Deliverable = implementation spec; the team did not edit code. No AI-model surface changes (the chat reuses the existing SSE pipeline), so the Haiku-first policy is not in play. Must not regress PR #5 or the 402px mobile frame.

**Locked decisions (lead + user, 2026-06-15):**
- Candidate content full-width, capped **1440px**; no >200px dead side-gutter at 1440.
- **402px mobile frame pixel-identical** (lg:-additive; CSS-only reflow, no DOM reorder).
- Form pages (profile/documents/applications/language-test) → **2-column: form + contextual side rail**.
- Chat → toggleable drawer: **desktop PUSHES content** (real right rail that reflows the page; collapses when closed), **mobile = full overlay**. Reuse shared `ChatPanel`/`CandChatPanel`.
- Chat route: **drawer replaces the route** — `/candidate/chat` redirects to `/candidate?openChat=1` (forward `prefill`); update all callers + the smoke-test runbook.
- Lang menu: additive `align` prop (default `right`); left-edge call sites pass `align="left"`.
- Enterprise candidates page: page-level mobile-responsive fix (shell already responsive).

**Team-verified facts (don't reintroduce):** `LanguageMenu` has only a `placement` (vertical) prop today — `align` is **net-new**. The dashboard is one flat `flex-col` column — no aside/lang-card there; the mobile-order risk is fixed via CSS grid placement only. `ChatPanel`'s composer is `position:fixed; left:0; right:0` (L239-249) — bleeds to viewport width; `composerOffset` can't fix it. **`ChatPanel` snapshots `initialMessages` into state at MOUNT ONLY (L52)** — re-passing after mount does nothing; the drawer must mount `CandChatPanel` only after the transcript fetch resolves. Tailwind multi-value `p-[14px_20px]` does NOT compile — use `py-[..] px-[..]` or inline. The CountryGuide `?prefill` deep-link is inert today; wiring it is net-new.

---

## Group A — Language-menu align (additive prop)

1. [components/mg/language-menu.tsx](../../components/mg/language-menu.tsx) — add `align?: "left" | "right"` to `LanguageMenuProps` (L12-15), default `"right"`; in the open listbox style (style object spans L89-102; `right: 0` at L94) replace `right: 0` with `...(align === "left" ? { left: 0 } : { right: 0 })`.
2. Per-call-site (audited, all 7): pass `align="left"` at left-edge/drawer triggers — [web-sidebar.tsx L193](../../components/mg/web-sidebar.tsx) (keep `placement="up"`), [cand-mobile-chrome.tsx L155](../../components/mg/cand-mobile-chrome.tsx), [mobile-shell.tsx L103](../../components/mg/mobile-shell.tsx). Keep default `right` at top-right bars — `cand-app-bar.tsx` L52, `public-shell.tsx` L88/L147/L231.

## Group B — Enterprise candidates page mobile fix

3. [app/enterprise/candidates/page.tsx](../../app/enterprise/candidates/page.tsx): **read the file first to re-anchor.** Filter row (~L165-171, fixed `gridTemplateColumns:"1fr 160px 2fr auto"`) → `className="grid grid-cols-1 sm:grid-cols-[1fr_160px_2fr_auto] gap-3 items-center"` (drop the inline grid style); `<select>` + skills `Input` get `w-full`. List-header (~L213-230) → `className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"` + keep padding inline or `py-[14px] px-5` (NOT `p-[14px_20px]`). Candidate row (~L248-257, `1fr auto`) → `className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4"`, keep the conditional `borderTop` + padding inline. Acceptance: no horizontal scroll at 390px, Apply in-bounds, rows readable.
4. [components/mg/candidate-action-bar.tsx](../../components/mg/candidate-action-bar.tsx) — add `flexWrap: "wrap"` to the **inner button row** (~L270, `display:flex; gap:6`), NOT the outer `flex-end` wrapper.

## Group C — Candidate shell width (1440 cap)

5. [app/candidate/layout.tsx](../../app/candidate/layout.tsx) L85-86 — widen the shared inner wrapper from `maxWidth: 720` to `maxWidth: 1440`, keep `width:"100%"` + padding; keep `<main className="flex-1 flex justify-center">` (centered → 0 dead gutter at ≤1440 viewport). Per-page content then constrains itself (Group D).

## Group D — Per-page layouts (CSS-only mobile preservation)

6. **Dashboard** [app/candidate/page.tsx](../../app/candidate/page.tsx) L142-371 — wrap the existing flat column in a grid (class `cand-dash-grid`, `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6`), **keeping children in current source order**; place the language-test card + chat-CTA card into a right-rail wrapper (classes `cand-page-rail cand-dash-rail`) at `lg+` via CSS grid placement — **no DOM reorder**, so 402px order is byte-identical. When chat opens, the `data-chat-open` cascade (Group E) hides `cand-dash-rail` and collapses `cand-dash-grid` to single-column, so the net desktop layout is `[sidebar 240] [content 1fr] [chat 360]` — no 3-column conflict.
7. **Matches** [app/candidate/matches/page.tsx](../../app/candidate/matches/page.tsx) — full 2-column at `lg+` (results list + a side rail for filters/summary, rail carries `cand-page-rail`); mobile order preserved via CSS only.
8. **Form pages — 2-col form + contextual side rail** (LD-1). Each gets `lg:grid lg:grid-cols-[minmax(0,720px)_1fr] lg:gap-8` (or similar), form left, contextual side panel right, capped within 1440; mobile single-column, order unchanged. **Each side-rail outer div carries `className="cand-page-rail …"`** so the `data-chat-open` cascade (Group E) hides it when the desktop chat pushes:
   - [profile/page.tsx](../../app/candidate/profile/page.tsx) → side rail: profile-completeness summary (reuse the profile score / missing-fields data already on the page).
   - [documents/page.tsx](../../app/candidate/documents/page.tsx) → side rail: upload checklist / required-docs status.
   - [applications/page.tsx](../../app/candidate/applications/page.tsx) → side rail: application status summary / counts (derive from the already-loaded `apps` list — no new query).
   - [language-test/page.tsx](../../app/candidate/language-test/page.tsx) → side rail: session-result summary. NOTE: page state holds only the CURRENT grading result — do NOT add a query; use the current-session summary or fall back to a generous ~1100px left-aligned column.
   If a page lacks obvious rail content, fall back to a generous left-aligned ~1100px column (no centered narrow gutters). Keep each file <500 lines (extract a side-rail subcomponent if needed).

## Group E — Chat drawer (push desktop / overlay mobile; replaces route)

**Shared contracts — LOCK these in `cand-chat-context.tsx` JSDoc before writing any other Group E file (see Ordering):** `useCandChat()` → `{ open, prefill, chatMode: "push"|"overlay", openChat(prefill?), closeChat(), toggleChat(), setChatMode(m) }`; push-shell root `div` class `cand-push-shell` with boolean attr `data-chat-open` toggled via `setAttribute`/`removeAttribute`; rail classes `cand-page-rail` (all form rails), `cand-dash-rail` + `cand-dash-grid` (dashboard).

9. [components/mg/cand-chat-context.tsx](../../components/mg/cand-chat-context.tsx) — **NEW, single source of truth**: `CandChatProvider` + `useCandChat()` with the exact signature above (`chatMode` defaults `"push"`). Client, no UI.
9b. [app/api/chat/transcript/route.ts](../../app/api/chat/transcript/route.ts) — **NEW `GET` handler** (the drawer's transcript + lang source; the page replaced by Group F #14 is currently the only loader). Mirror `app/api/chat/route.ts` auth (L98-171): `auth()` → 401 if no session; `prisma.user.findUnique({ where:{clerkId}, select:{ role:true, lang:true, candidate:{select:{id:true}} } })` (**include `lang`** — the drawer is client-side and has no other server lang source for CandChatPanel's required `lang` prop); `role !== "CANDIDATE"` → 403; signed-in CANDIDATE with no candidate row → **404** ("Complete onboarding first", matching /api/chat L166-168 — NOT 403); `const transcript = await loadTranscript(candidate.id)` (from lib/social/llm-bridge); `return NextResponse.json({ messages: transcript.map(m => ({ role:m.role, text:m.text, at:m.at })), lang: user.lang })` (messages = the same projection the current page uses, strips externalId); header `Cache-Control: no-store`; `export const runtime="nodejs"; export const dynamic="force-dynamic"`; abuse guard `rateLimit(clerkId, "chat.transcript", 10, 60)` → 429. <60 lines.
10. [components/chat/chat-panel.tsx](../../components/chat/chat-panel.tsx) — add `drawer?: boolean` (default false) + `prefill?: string`. When `drawer`: composer (L239-249) `position:fixed` → `sticky`, drop `left:0/right:0`, keep `bottom:0`; `minHeight` (L190) uses container height not `calc(100dvh-…)`; verify `padding-bottom:200px` (L215) isn't doubled. **Prefill seeding (one-time, guarded — avoids the mount race where ChatPanel mounts with prefill="" before the bridge fires):** `const [seeded,setSeeded]=useState(false); useEffect(()=>{ if(!seeded && prefill){ setText(prefill.slice(0,500)); setSeeded(true);} },[prefill,seeded])`. This is prefill's ONLY effect — populate the textarea; NEVER call `send()`; never forward prefill into a POST body. Controlled `<textarea>` (no dangerouslySetInnerHTML, confirmed L301-324) = XSS-safe. **Prop-gated so /enterprise/chat + standalone are byte-unchanged** (500-line watch: split composer into chat-composer.tsx if the branch >420).
11. [app/candidate/chat/chat-panel.tsx](../../app/candidate/chat/chat-panel.tsx) (`CandChatPanel`) — accept + forward `drawer` + `prefill` to `ChatPanel`; in drawer mode pass `composerOffset={0}`.
12. [app/candidate/chat/chat-drawer.tsx](../../app/candidate/chat/chat-drawer.tsx) — **NEW, UI only** (imports `useCandChat` from the context file).
   - **Transcript loading (Finding #1, the mount trap):** drawer owns `const [messages,setMessages]=useState<ChatMessage[]|null>(null)`, `const [lang,setLang]=useState<ChatLang|null>(null)`, `const [fetching,setFetching]=useState(false)` (`ChatMessage`/`ChatLang` import from `app/candidate/chat/chat-panel.tsx`, the only export site). On first open (`useEffect` gated `open && messages===null && !fetching`): set fetching → `GET /api/chat/transcript` → `setMessages(data.messages); setLang(data.lang)` → clear fetching. While `messages===null` render a loading skeleton **instead of** CandChatPanel; mount `CandChatPanel initialMessages={messages} lang={lang ?? "FR"} drawer prefill={prefill}` ONLY once `messages!==null` (ChatPanel reads initialMessages at mount only, L52, so mounting before the fetch = permanently empty thread; `lang` arrives in the same response so the required prop is satisfied). The `fetching` flag (not just a post-success flag) blocks a duplicate GET on fast open/close/reopen.
   - **Push behavior (Findings #2/#3):** push-shell root class `cand-push-shell`; toggle boolean attr `data-chat-open` via setAttribute/removeAttribute (cascade fires without an attribute-render cycle). On the `open` transition read `window.innerWidth`; if `< 1060` (240 sidebar + 360 chat + 460 min content) → `setChatMode("overlay")`. **Push** (`lg+`, wide): grid right track `0`→`360px`, content reflows left; the `[data-chat-open]` cascade hides page rails + collapses the dash grid (globals.css below). **Overlay** (mobile always, or desktop `<1060`): drawer `position:fixed; inset-y:0; right:0; width:360px`, grid track stays 0. Threshold read at open-time only (not on resize) — documented gap; add a resize listener only if a regression appears.
   - **Mobile z-index + single-open (Finding #5):** chat scrim `zIndex:30` (above content, below nav scrim 40); chat panel `zIndex:45` (above nav scrim 40, below nav drawer 50 — nav keeps priority; above CandTabBar 10). `openChat()` dispatches `window.dispatchEvent(new CustomEvent("mg:close-nav"))`; [cand-mobile-chrome.tsx](../../components/mg/cand-mobile-chrome.tsx) adds a `useEffect` listener for `"mg:close-nav"` → `setOpen(false)` (reuses its scrim-dismiss). Close button + scrim-dismiss + Esc.
13. [app/candidate/layout.tsx](../../app/candidate/layout.tsx) — wrap the shell in `<CandChatProvider>`; render the client push-shell wrapping `<main>` + `<ChatDrawer/>` once, above both the `hidden lg:flex` and `lg:hidden` subtrees. Import chain: `layout → CandChatProvider (context) + ChatDrawer (drawer) → useCandChat (context)` (acyclic). **Do NOT call `useSearchParams()` here or in the provider** (Finding #6) — the deep-link read is #13b.
13b. [app/candidate/_components/chat-search-params-bridge.tsx](../../app/candidate/_components/chat-search-params-bridge.tsx) — **NEW client leaf** (~20 lines), the ONLY candidate-tree file calling `useSearchParams()`. `const sp=useSearchParams(); useEffect(()=>{ if(sp.get("openChat")==="1") openChat((sp.get("prefill")??"").slice(0,500)); },[])`. In the layout, inside `<CandChatProvider>`, render `<Suspense fallback={null}><ChatSearchParamsBridge/></Suspense>` (Suspense below the provider so context exists when it fires; satisfies App Router's useSearchParams-needs-Suspense rule → no build warning). Fires on mount only — the CountryGuide deep-link + the /candidate/chat redirect are hard navigations, so both work.

**globals.css rules (lg-scoped so mobile is untouched):**
```css
@media (min-width: 1024px) {
  [data-chat-open] .cand-page-rail { display: none; }
  [data-chat-open] .cand-dash-rail { display: none; }
}
@layer utilities {
  @media (min-width: 1024px) {
    [data-chat-open] .cand-dash-grid { grid-template-columns: minmax(0, 1fr) !important; }
  }
}
```
The `@layer utilities` + `!important` on the grid collapse is REQUIRED — a plain rule loses to Tailwind's `lg:grid-cols-[…]` arbitrary utility under PostCSS layer ordering and silently no-ops.

## Group F — Route replacement + callers (LD-3)

14. [app/candidate/chat/page.tsx](../../app/candidate/chat/page.tsx) — replace the full-page server component with `redirect("/candidate?openChat=1")`. To forward `?prefill`, ADD `{ searchParams }` to the function signature (none today: `CandidateChatPage()`), read `searchParams.prefill`, append it (capped) to the redirect target when present.
15. Nav entries → open the drawer instead of navigating: [app/candidate/layout.tsx L42](../../app/candidate/layout.tsx) remove the `chat` `NAV_ITEMS` entry (replaced by a sidebar chat icon); the desktop sidebar footer is in [components/mg/web-sidebar.tsx](../../components/mg/web-sidebar.tsx) L191-195 (where LanguageMenu + ThemeToggle render) — **NOT `cand-web-sidebar.tsx`, which is a prop-only pass-through** — add a `message-circle` button calling `openChat()` next to ThemeToggle there (do NOT use WebSidebar's `footer` prop — it's guarded `{!user && footer}` at L189, only rendering when logged out); [components/mg/cand-tab-bar.tsx L21](../../components/mg/cand-tab-bar.tsx) chat tab → `button` calling `openChat()` (active when `open`).
16. [app/candidate/page.tsx](../../app/candidate/page.tsx) chat-CTA (~L365) → call `openChat()` (extract a tiny client `CandChatCtaCard` reading `useCandChat`, so the page stays a server component).
17. [components/integration/CountryGuide.tsx L105](../../components/integration/CountryGuide.tsx) — change `askHref` to `/candidate?openChat=1&prefill=${encodeURIComponent(PREFILL_QUESTION[lang].slice(0,500))}` (add `openChat=1`; `.slice(0,500)` before encode = defense-in-depth cap). Do NOT `router.push` or append prefill to any POST body.
18. [docs/smoke-test-runbook.md L57](../../docs/smoke-test-runbook.md) — update step 18 from "visit /candidate/chat" to "open the chat drawer from /candidate (or visit /candidate?openChat=1)".

## Group G — i18n

19. Add new keys (drawer open/close aria, rail labels) to `i18n/fr.json` + `i18n/en.json`; mirror into `i18n/mg.json` as `[MG-TODO]` (MG falls back to FR). Reuse the `app.candidate.chat.*` namespace where possible.

---

## Tailwind / correctness guardrails
- Never emit multi-value arbitrary padding `p-[a_b]` (renders zero padding) — use `py-[..] px-[..]` or inline. Arbitrary `grid-cols-[…]` IS valid (confirmed in use).
- The dash-grid collapse MUST be `@layer utilities` + `!important` (beats Tailwind's `lg:grid-cols-[…]`).
- Drawer-mode `ChatPanel` changes are prop-gated (`drawer` default false) — `/enterprise/chat` and standalone candidate chat must be byte-unchanged.

## Ordering / atomicity
**Shared contracts locked before any Group E file is written** (documented in `cand-chat-context.tsx` JSDoc): the `useCandChat()` signature, the `cand-push-shell`/`data-chat-open` push-shell contract, and the rail classes (`cand-page-rail`, `cand-dash-rail`, `cand-dash-grid`) — see Group E header.
**Group E is ONE atomic commit** (steps #9 → #9b → #10 → #11 → #12 → #13 → #13b + the globals.css rules, in order). It is a tightly-coupled ~9-file unit — no Group E step lands in isolation or is parallelized with another Group E step. **Group F is gated on Group E fully landed.** Groups A, B, C, D-non-chat may be committed independently.
Suggested commits (each revertable):
1. lang-menu align (A 1→2)
2. shell width (C #5) + dashboard/matches grid (D #6/#7 — add the cand-* classes, no chat behavior yet)
3. form pages + side rails (D #8 — each rail carries `cand-page-rail`)
4. enterprise candidates page (B #3/#4)
5. **[atomic] chat feature** (E #9,#9b,#10,#11,#12,#13,#13b + globals.css)
6. route replacement + callers + runbook (F #14-18)
7. i18n (G #19)

500-line watch: `chat-panel.tsx` (~380; split composer if drawer branch >420), `app/candidate/page.tsx` (~372; grid wrapper-only).

## Verification
- `npm run build` green (**no "useSearchParams() should be wrapped in a Suspense boundary" warning**); full `npm test` green.
- **Static grep gates:** `grep dangerouslySetInnerHTML components/chat/chat-panel.tsx` → 0; `grep useSearchParams app/candidate/` → exactly 1 (the bridge); CountryGuide `askHref` contains `.slice(0, 500)` before `encodeURIComponent`.
- **Transcript (Finding #1):** `GET /api/chat/transcript` → 401 (no session) / 403 (non-CANDIDATE) / 404 (CANDIDATE, no row) / `{role,text,at}[]` (valid). Drawer shows a skeleton until the fetch resolves, then the thread is populated (not silently empty); a fast open/close/reopen fires exactly one GET.
- **Playwright 390px:** no horizontal scroll on /candidate, /candidate/{matches,profile,documents,applications,language-test}, /enterprise/candidates; Apply in-bounds; chat opens as a full-width overlay (scrim z-30, panel z-45) with the composer inside it; opening chat closes the nav drawer; **dashboard child DOM order byte-identical pre/post**; 600-char prefill → textarea ≤500 chars, 0 assistant bubbles after load (no auto-send); `<img onerror>` prefill renders as literal text (no alert/img).
- **Playwright 1440px:** dashboard + matches fill the wrapper (content box ≥ ~1240px); form pages show 2-col form+rail. **Chat open at 1440:** content reflows to `[1fr 360]`, `.cand-page-rail`/`.cand-dash-rail` computed `display:none`, `.cand-dash-grid` single track, composer confined to the 360px rail, no horizontal scroll. **Chat open at 1280:** rail hidden OR drawer overlay (`<1060` → overlay). Lang menu opens left-aligned in the sidebar, right-aligned in top bars.
- **Regression:** /enterprise/chat composer unchanged (drawer default false); CountryGuide "Ask agent" → `/candidate?openChat=1&prefill`, drawer opens seeded; redirect `/candidate/chat → /candidate?openChat=1` opens the drawer.

## Deferred / out of scope
- MG translations (placeholders only). Prefill is wired but the advisor behavior is unchanged. No matching/SSE/Prisma changes. Resize-time push↔overlay re-evaluation (threshold read at open-time only).
