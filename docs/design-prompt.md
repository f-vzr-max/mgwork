# MG Work — Claude Design Prompt

> Copy-paste this whole document into a new Claude conversation (or hand it to
> a Claude design agent / generator) to produce a dynamic, intuitive, modern
> visual design that drops into the MG Work codebase **without rewriting
> features or breaking integrations**.
>
> The prompt is split into three blocks:
>
> 1. **Operating instructions** — what Claude must do and must not do.
> 2. **Hard constraints** — the codebase facts the design must respect.
> 3. **Design brief** — the look, feel, screens, and components to produce.

---

## 1. Operating instructions for Claude

You are designing the visual + interaction layer of an existing production
codebase. This is **not** a greenfield project. Your job is to produce a
modern, dynamic, intuitive design **that overlays cleanly on the current
Next.js 14 + Tailwind + shadcn-style app** described below.

### What to deliver

For every screen / surface listed in §3.7 produce:

1. A short rationale (1–3 bullets): user goal, primary action, success state.
2. A high-fidelity layout description (what's where, hierarchy, spacing, copy
   tone). Annotate breakpoints (mobile 375px, tablet 768px, desktop 1280px).
3. A component list, mapped to existing files when possible (see §2.4).
   Mark any new component as **NEW** with a proposed path under
   `components/ui/` or the matching domain folder.
4. A motion / interaction note: hover, focus, loading, empty, error, success.
5. The Tailwind utility classes you'd use (using the tokens in §2.2 only —
   do NOT introduce new color hex values inline).

For the design system itself (§3.1–3.6) deliver concrete token tables, a
component inventory with prop signatures (TypeScript-style), and at least one
ASCII / textual mockup per major surface so the result can be implemented
without further clarification.

### Hard "do not" list

- Do **not** change Prisma models, API routes, or auth flow.
- Do **not** rename files, routes, or i18n keys.
- Do **not** introduce new design libraries (no Material, no Chakra, no
  Mantine, no DaisyUI, no Ant). Stay within Tailwind + shadcn-style + Radix
  primitives + lucide-react icons. `framer-motion` is allowed if needed.
- Do **not** invent brand colors. The four brand colors in §2.2 are fixed.
  All other colors must be derived from those + neutrals.
- Do **not** use emojis in UI copy. Use lucide icons.
- Do **not** propose dark-mode-only or light-mode-only — both must work
  (the codebase already exposes `.dark` CSS variables).
- Do **not** propose anything that breaks i18n (FR / EN / MG). Strings must
  fit the longest of the three languages without truncation. French is ~20%
  longer than English; Malagasy can be 30%+.
- Do **not** propose mobile interactions that require hover (candidate flow
  is mobile-first).
- Do **not** propose layouts that ignore RTL — but RTL is not required, so
  just don't actively block it.
- Do **not** propose anything that requires server-state changes (sockets,
  realtime, webhooks). The chat already streams via SSE; reuse that.

### Output format

Markdown, in this exact order:

```
1. Design system
   1.1 Color tokens (table mapping CSS vars → role → use cases)
   1.2 Typography scale
   1.3 Spacing + radius + elevation
   1.4 Motion primitives
   1.5 Iconography rules
2. Component inventory (table: name, status [exists | extend | new], path, props)
3. Layout shells (public, candidate, enterprise, admin, staff)
4. Screens (one section per screen in §3.7)
5. Empty / loading / error states catalogue
6. Accessibility checklist (WCAG 2.2 AA)
7. Implementation plan (ordered, with rough effort tags S / M / L)
```

Keep each section short. Bullets and tables over prose. No filler.

---

## 2. Hard constraints (the codebase facts)

### 2.1 Stack you must work with

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components by default |
| Styling | Tailwind CSS + tailwindcss-animate | shadcn-style local components (`components/ui/*`) |
| Primitives | Radix UI (dialog, dropdown, slot, avatar) | Already installed |
| Icons | `lucide-react` v1.14 | Whitelist below in §2.5 |
| Auth UI | Clerk (`@clerk/nextjs`) | We embed Clerk widgets as-is |
| i18n | `next-intl` | FR primary, EN, MG. Locale is per-user, persisted |
| Forms | `react-hook-form` + `zod` resolvers | Multi-step forms exist |
| Email | Resend + `@react-email/components` | Templates live in `emails/` |
| Analytics | Vercel Analytics + Sentry | Already wired in `app/layout.tsx` |
| Build | Vercel | No Edge-runtime UI quirks needed |

You **must not** add new top-level deps without flagging it. If you propose
`framer-motion` or `@radix-ui/react-tabs` etc., list them under
"Implementation plan → New dependencies" with one-line justification each.

### 2.2 Brand tokens (FIXED)

CSS variables live in `app/globals.css`. Brand hex values live in
`tailwind.config.ts` under `colors.brand.*`. **Do not** change either; design
around them.

| Token | HSL (light) | Hex | Role |
|---|---|---|---|
| `--background` | `0 0% 100%` | `#FFFFFF` | App background |
| `--foreground` | `222 47% 11%` | near-black | Body text |
| `--primary` | `213 62% 27%` | `#1A3C6E` (brand blue) | Primary actions, links, brand |
| `--success` | `163 100% 24%` | `#007B55` (brand green) | Success, positive states, deployment OK |
| `--destructive` | `6 64% 46%` | `#C0392B` (brand red) | Errors, dangerous actions, alerts |
| `--muted` | `210 40% 96%` | very light blue-gray | Section backgrounds, page bg |
| `--card` | `0 0% 100%` | white | Card surfaces |
| `--border` | `214 32% 91%` | light gray | Hairlines |
| `--ring` | `213 62% 27%` | brand blue | Focus rings |
| `--radius` | `0.5rem` | — | Corner radius base |

Dark mode tokens already exist (see `globals.css` `.dark` block). Mirror any
new token there.

You **may** introduce derived neutral steps (e.g. `--surface-1`, `--surface-2`)
and tonal accents (e.g. info-blue ≠ brand blue) **only if** you also list them
in `globals.css` in your output.

### 2.3 Roles and surfaces (FIXED)

Six user roles → five surface shells. The current sidebar shells are:

| Surface | Path | Shell file | Sidebar items |
|---|---|---|---|
| Public / marketing | `/` | `app/page.tsx` | Header only, language toggle, sign-in / sign-up CTA |
| Onboarding | `/onboarding/(candidate\|enterprise)` | per-page | Card + stepper, no sidebar |
| Candidate | `/candidate/*` | `app/candidate/layout.tsx` | Dashboard, Profile, Documents, Job offers, Applications, Chat |
| Enterprise | `/enterprise/*` | `app/enterprise/layout.tsx` | Dashboard, Job offers, Candidates, Interviews, Documents, Invoices |
| Admin | `/admin/*` | `app/admin/layout.tsx` | Overview, Users, Disputes, Invoices, Audit log, Feature flags, Translations |
| Staff | `/staff/*` | `app/staff/layout.tsx` | Dashboard, Document queue, Follow-ups, Alerts |

The sidebar itself is `components/layout/sidebar.tsx`. It already supports a
`brandLabel`, a `NavItem[]`, an icon name (mapped to lucide), and the Clerk
`UserButton` + `LanguageSwitcher` at the bottom. Your design should keep this
contract or extend it (e.g. add a `badge` count for queue items) — not
replace it.

The page header is `components/layout/page-header.tsx`. It accepts `title`,
`description`, and a `children` slot for action buttons. Keep that contract.

### 2.4 Existing components (reuse first, extend second, replace last)

Your design must reuse these wherever possible. Mark components in the
inventory as **exists**, **extend**, or **new**.

```
components/
  ui/
    button.tsx           # variants: default, destructive, success, outline,
                         #            secondary, ghost, link. sizes: sm/default/lg/icon
    card.tsx             # Card + Header + Title + Description + Content + Footer
    input.tsx            # base input
  layout/
    sidebar.tsx          # role-shell sidebar (see §2.3)
    page-header.tsx      # page title + description + action slot
    LanguageSwitcher.tsx # FR / EN / MG toggle
  LanguageToggle.tsx     # public-page language toggle (lighter-weight)
  onboarding/
    Stepper.tsx          # numbered step rail with done/current/upcoming states
    CandidateStep*.tsx   # 5 candidate onboarding step components
    EnterpriseStep*.tsx  # 3 enterprise onboarding step components
    OnboardingRedirector.tsx
  chat/
    Thread.tsx           # message bubbles, auto-scroll, time stamps
    Composer.tsx         # message input + send
  staff/
    QueueRow.tsx
    StatusBadge.tsx      # tones: neutral, info, success, warning, danger
                         # mappers: checkpointStatusTone, documentStatusTone
    StatsBar.tsx
    InlineScanViewer.tsx
    DocumentReviewForm.tsx
    InterventionForm.tsx
    NoteForm.tsx
  admin/
    FeatureFlagsManager.tsx
    MarkPaidForm.tsx
    NewInvoiceForm.tsx
    TranslationsManager.tsx
    UserActionsMenu.tsx
  documents/
    DocumentRow.tsx
    ScanViewer.tsx       # zoom, rotate, multi-page
    UploadDialog.tsx
  calendar/
    MonthGrid.tsx        # used for interviews + checkpoints
  checklist/
    DepartureChecklist.tsx
  integration/
    CountryGuide.tsx     # static + LLM deep-link
  interviews/
    InterviewForm.tsx
  timeline/
    StatusTimeline.tsx
```

Components **likely missing** (propose as **new**):

- Avatar (Radix is installed but no wrapper)
- Badge (the closest thing is `staff/StatusBadge`; we want a generic one)
- Dialog wrapper (Radix is installed)
- Dropdown menu wrapper (Radix is installed)
- Tabs
- Tooltip
- Popover
- Toast / Sonner
- Skeleton
- Progress (linear + circular — needed for `profileScore`, match score)
- Score gauge (radial 0–100, used heavily by matching engine)
- Empty state
- Table / data list
- Combobox / multi-select chips (for skills, sectors, requirements)
- File dropzone (extension of `UploadDialog`)
- Slider (admin matching weights)
- Form field wrapper (label + control + helper + error, RHF-aware)

### 2.5 Lucide icons already mapped

The sidebar registry hard-codes these — adding a new nav icon means adding
to the registry first:

`activity, alertTriangle, briefcase, building2, clipboardList, fileCheck,
fileText, layoutDashboard, messageCircle, receipt, shieldCheck, user, users`

Other lucide icons may be used freely inside content; new sidebar icons
must be added to the `ICONS` registry in `components/layout/sidebar.tsx`.

### 2.6 Domain enums you must visualise

Design must provide a clear visual treatment for each of these — colors,
icons, badge tone, progression order. They drive most lists/cards.

| Enum | Values | Notes |
|---|---|---|
| `Role` | SUPER_ADMIN, ADMIN, STAFF_FOLLOWUP, STAFF_DOCUMENTS, ENTERPRISE, CANDIDATE | Role chips on user rows |
| `DocumentType` | PASSPORT, MEDICAL_AUTHORIZATION, WORK_PERMIT, VISA, INCORPORATION_CERTIFICATE, OTHER | Doc icon per type |
| `DocumentStatus` | PENDING, APPROVED, REJECTED, EXPIRED | Already mapped → info / success / danger / warning |
| `ApplicationStatus` | APPLIED, SHORTLISTED, INTERVIEW_SCHEDULED, INTERVIEW_DONE, OFFER_MADE, DEPLOYED, COMPLETED, REJECTED | Linear pipeline — see `StatusTimeline` |
| `OfferStatus` | DRAFT, ACTIVE, PAUSED, CLOSED | Color: muted / success / warning / muted |
| `CheckpointStatus` | OK, ALERT, INTERVENTION_REQUIRED | Already mapped → success / warning / danger |
| `SocialPlatform` | WHATSAPP, MESSENGER, INSTAGRAM, TIKTOK, IN_APP | Brand icons in conversations list |
| `Language` | FR, EN, MG | Already toggled |
| Plan | FREE, STARTER, PRO | Plan chip on enterprise + offer creation |

### 2.7 Mobile-first

Candidate flow is mobile-first (375px). All candidate screens must work
without horizontal scroll, with the bottom 80px reserved for thumbs, and
no hover-only affordances. The sidebar collapses to a top app bar +
bottom-tab bar at `< md`. Propose this; it does not exist yet.

Enterprise / admin / staff are web-first; usable on tablet, optimal at
1280px+.

### 2.8 Performance and accessibility floor

- Server components by default; client components only when interactive.
  Don't propose patterns that force client-only rendering of static lists.
- LCP target < 2.5s on 3G fast for `/candidate` and `/`. No hero images
  larger than 200 KB, all `next/image`.
- WCAG 2.2 AA: 4.5:1 for body, 3:1 for large; visible focus ring on every
  interactive element; keyboard reachability for every action; aria-live
  for the chat stream, queue claims, and toasts.
- Reduced motion: respect `prefers-reduced-motion` for all motion below.

### 2.9 What "integrate without issues" means

A component is integration-safe if:

1. It accepts the props the existing call sites already pass. Example: any
   new `Sidebar` must accept `brandLabel: string`, `items: NavItem[]`,
   `currentLang?: "FR"|"EN"|"MG"`.
2. It uses only the existing CSS-var tokens (or new ones added in your
   `globals.css` patch).
3. It does not change the shape of API responses or Prisma models.
4. Strings are i18n keys, not hard-coded text. Use `useTranslations()` /
   `getTranslations()`. Add new keys to `i18n/{en,fr,mg}.json` in your
   plan, with English source + a note that FR + MG translations are owed.
5. Server vs client boundary stays sane: the file starts with `"use client"`
   only when state, refs, effects, or browser APIs are needed.

---

## 3. Design brief

### 3.1 Visual personality (one paragraph)

MG Work is **trust + motion**. Trust because it moves people across borders
under legal compliance — it cannot look like a startup toy. Motion because
the platform is mobile-first for a young audience and matches happen fast.
Aesthetically: **calm, confident, editorial typography, generous white
space, brand blue as anchor, brand green for forward momentum, brand red
held in reserve for danger.** Think *Linear-meets-Notion-meets-Stripe-docs*,
filtered through an Indian-Ocean palette. No gradients heavier than a
single soft brand-blue → muted fade. No skeuomorphism. No drop shadows
heavier than `shadow-md`.

### 3.2 Color usage rules

- Brand blue (`primary`) is the only color used on primary actions, links,
  active nav items, and the logo.
- Brand green (`success`) is reserved for: completed states, deployed
  candidates, OK checkpoints, paid invoices, profile-completeness >= 80%.
- Brand red (`destructive`) is reserved for: errors, dangerous destructive
  actions (delete user, cancel offer, intervention required), expired
  documents.
- Neutral gray scale (derived from `--muted`) carries 80% of the surface
  area — backgrounds, text, hairlines, table dividers.
- Add tonal accents from the same hue family as the brand color when needed
  (e.g. `--info` blue can differ from `--primary` brand blue, but should be
  same hue family).

### 3.3 Typography

Inter (already loaded via `next/font/google` in `app/layout.tsx`).
Define a clear scale, mobile + desktop. Body 16px on mobile, 15px on
desktop. Numerals: tabular for KPI cards.

Required scale (propose exact values):

`display, h1, h2, h3, h4, body-lg, body, body-sm, caption, micro,
mono` (mono for invoice references, document IDs).

### 3.4 Spacing + radius + elevation

- 4-pt base. Components snap to 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Page padding: 16 (mobile), 24 (tablet), 32 (desktop) — already used
  inconsistently as `p-6` / `px-8`. Propose a single rule and apply it
  everywhere.
- Radius: card `lg` (8px), input `md` (6px), pill `full`. Already set in
  Tailwind config.
- Elevation: only three levels — `shadow-sm` for cards, `shadow-md` for
  popovers / dialogs, `shadow-lg` for the global toast region. Nothing else.

### 3.5 Motion primitives

Use `tailwindcss-animate` (already installed) and optionally `framer-motion`
for shared layout transitions. Required primitives:

- `fade-in` 120ms
- `slide-up` 180ms (cards entering)
- `accordion-down/up` (already defined)
- `pulse-soft` (active queue rows, "new match" pings)
- `shimmer` (skeleton loaders)
- Score gauge fill animation (0 → score, 600ms, ease-out)
- Stepper progress fill (180ms)
- Toast slide-in from bottom-right desktop / bottom-center mobile

### 3.6 Iconography rules

- Lucide only, 16px in dense lists, 20px standalone, 24px in feature blocks.
- Stroke 1.5. Color inherits from text.
- One icon per sidebar item, one per status badge, one per document type.
- Social platform icons: lucide where available (`message-circle`); for
  WhatsApp / Messenger / Instagram / TikTok use brand SVGs added to
  `public/icons/social/*.svg` so they keep their identity.

### 3.7 Screens to design

Group A — public + auth shells:

1. Landing page (`/`) — hero, three pillars (mobile-first onboarding, AI
   matching, post-deployment care), social-bar (TikTok / WhatsApp /
   Messenger / Instagram chips that deep-link), enterprise vs candidate
   split CTA, footer with compliance line. Today: bare hero + two buttons.
2. Sign-in / sign-up (`/sign-in`, `/sign-up`) — Clerk widget host. Apply
   a brand-blue side panel on desktop with a rotating compliance proof
   (DPA Mauritius 2017 line, success placement count, etc.).
3. Sign-up role choice (`/sign-up/choose`) — candidate vs enterprise card,
   already roughed in i18n.
4. Onboarding router (`/onboarding`) — calm waiting state.
5. Candidate onboarding (`/onboarding/candidate`) — keep 5-step
   `Stepper`, rethink the visual treatment: progress bar at top, big
   step label, generous form fields, soft restored-draft banner, sticky
   bottom action bar on mobile.
6. Enterprise onboarding (`/onboarding/enterprise`) — same treatment, 3
   steps (company / contact / KYC).

Group B — candidate (mobile-first):

7. Candidate dashboard (`/candidate`) — replace the three flat cards with a
   "what to do next" stack: profile completeness gauge + the single next
   action, latest matches with score gauges, document status row, chat CTA.
8. Candidate profile (`/candidate/profile`) — single scrollable page; chips
   for skills / sectors; inline language scores; upload-CV affordance.
9. Documents (`/candidate/documents`) — wallet metaphor: status badge + days
   until expiry + re-upload action per row; expiry banner if any < 30d.
10. Job offers (`/candidate/jobs`, `/candidate/jobs/[id]`) — list with
    score gauge, sector chip, location, apply CTA. Detail page with
    "Why this match" breakdown using the criteria scores already returned
    by the matching engine.
11. Applications (`/candidate/applications`, `/candidate/applications/[id]`)
    — pipeline timeline using `ApplicationStatus`. Reuse `StatusTimeline`.
12. Chat (`/candidate/chat`) — full-height streaming chat; reuse `Thread`
    + `Composer`; add a quick-prompt rail (Country guide, Document help,
    Interview prep) that prefills the composer.
13. Departure checklist (`/candidate/departure`) — interactive checklist
    (`DepartureChecklist`) styled as grouped cards with progress.
14. Country guide (`/candidate/integration`) — already exists
    (`CountryGuide`); restyle as a magazine grid of cards.

Group C — enterprise (web-first):

15. Enterprise dashboard (`/enterprise`) — KPIs (active offers, shortlisted,
    deployed) with sparklines, latest matches feed, plan + quota panel.
16. Job offers list (`/enterprise/offers`) — quota banner, status chips,
    application + shortlist counts. Already there in skeleton; restyle.
17. New offer (`/enterprise/offers/new`) — multi-section form, sticky
    summary panel on desktop showing "0 / 3 free offers used".
18. Offer detail (`/enterprise/offers/[id]`) — header with status / plan
    chip, AI shortlist (top 5 candidates with score gauges), all
    applications table, edit / pause / close actions.
19. Candidates browse (`/enterprise/candidates`) — searchable / filterable
    list of candidate previews (no PII beyond first name + city + sector).
20. Interviews (`/enterprise/interviews`, `/[id]`) — calendar grid
    (`MonthGrid`) + agenda list; detail with notes form and (later) video
    embed slot.
21. Documents (`/enterprise/documents`) — uploaded enterprise KYC docs.
22. Invoices (`/enterprise/invoices`) — list with status badges + payment
    method chip (WIRE / MOBILE_MONEY).

Group D — admin (web-first, dense):

23. Admin overview (`/admin`) — already wired to live KPIs; restyle into
    a dashboard grid with sparklines, alert callouts, top movers.
24. Users (`/admin/users`, `/[id]`) — searchable table with role chips,
    bulk actions, impersonate / ban / verify menu.
25. Disputes (`/admin/disputes`) — Kanban-ish board (open / in progress /
    resolved) tied to checkpoints with `INTERVENTION_REQUIRED`.
26. Invoices (`/admin/invoices`, `/new`, `/[id]`) — CRUD with payment
    workflow. `MarkPaidForm` and `NewInvoiceForm` already exist; reskin.
27. Matching config (`/admin/matching-config`) — sliders for criterion
    weights with live preview of a sample candidate's score breakdown.
28. Audit log (`/admin/audit`) — virtualised table, filter by user / action
    / resource / date range.
29. Feature flags (`/admin/feature-flags`) — toggle list with description.
30. Translations (`/admin/i18n`) — key, FR, EN, MG side-by-side editor.

Group E — staff (web-first, queue-driven):

31. Staff dashboard (`/staff`) — three queue cards with live counts and
    "claim next" CTAs. Replace the empty shell.
32. Document queue (`/staff/documents`, `/[id]`) — list with priority
    flag, scan viewer (`ScanViewer`), validate / reject form
    (`DocumentReviewForm`). Personal stats bar (`StatsBar`).
33. Follow-up (`/staff/followup`, `/[applicationId]`) — list of active
    deployments grouped by company, checkpoint badges, intervention
    form.
34. Alerts (`/staff/alerts`) — feed of doc-expiry, missed-checkin, raised
    interventions.

### 3.8 Cross-cutting patterns to design

- Empty state: illustration-light (one lucide icon at 32px in a brand-blue
  circle), single sentence, single CTA.
- Loading: prefer skeletons over spinners. Spinner only for actions
  shorter than 800ms.
- Error: inline first (under field / above section). Toast for
  request-level. Full-page only when route fails to load.
- Success: green check + sentence + next-step link. Toast auto-dismiss 4s.
- "Why this score?" pattern: a score gauge (0–100) with a popover that
  lists the criteria breakdown. Used in matches, applications, admin
  matching config preview.
- Language switcher: persistent, present on every shell. Already exists
  (`LanguageSwitcher` for authed shells; `LanguageToggle` for public).

### 3.9 What "dynamic" means here

Movement that **earns its place**. Concretely:

- Score gauges fill on mount.
- Stepper bar fills as steps complete.
- New match arriving while the dashboard is open: soft pulse on the row
  for 1.2s, then settle.
- Sidebar active-item indicator slides between items.
- Document status changes: cross-fade the badge.
- Toasts slide in from bottom.
- No parallax. No page-load splash. No autoplay anything.

### 3.10 What "intuitive" means here

- One primary action per screen. Always visible above the fold on mobile.
- The next thing the user should do is the most prominent thing on the
  screen. On the candidate dashboard that is: "Finish your profile" if
  `profileScore < 100`, otherwise "Review N new matches".
- Forms validate on blur, not on every keystroke; submit-time errors
  scroll to the first invalid field.
- Status is always shown as label + color + icon (never color alone — color
  blindness).
- Pricing / plan limits are explained at the moment of friction (e.g. free
  plan offer cap is shown on the New Offer button as a tooltip + on the
  list page as a banner).

### 3.11 Out-of-scope (do not design)

- Native mobile app shell (this is a web app).
- The marketing site beyond the landing page in §3.7.1.
- Payment UI on Stripe — there is no Stripe.
- The video-call surface; an iframe slot is enough.
- The Meta webhook admin — already a JSON-only API.

---

## 4. Inputs Claude can ask for

If anything below is unclear, ask before designing — don't guess.

- Final brand mark / wordmark (current is text-only "MG Work").
- Photography or illustration policy (current: none — text-first).
- Sample candidate + enterprise data for screenshots (otherwise produce
  fictional but realistic Malagasy / Mauritian names + sectors:
  agriculture, hospitality, construction, BPO, healthcare).
- Whether `framer-motion` is approved (otherwise stick to
  `tailwindcss-animate`).

---

## 5. Acceptance checklist (Claude must self-verify)

Before returning the design, confirm in the output:

- [ ] All §3.7 screens covered, with rationale + layout + components +
      motion + Tailwind classes.
- [ ] Every component is mapped to **exists | extend | new** with a path.
- [ ] Every status / role / plan in §2.6 has a defined visual treatment.
- [ ] Mobile (375px), tablet (768px), desktop (1280px) addressed for at
      least the candidate flow and the enterprise offer-create flow.
- [ ] FR + EN + MG copy length tested for the two longest microcopy
      strings (sign-up role choice + onboarding banner). Layouts hold.
- [ ] Light + dark mode token tables both present.
- [ ] No emoji. No new design library. No new brand color.
- [ ] No prop signatures broken on existing components (`Sidebar`,
      `PageHeader`, `Stepper`, `Thread`, `Composer`, `StatusBadge`).
- [ ] WCAG 2.2 AA checklist filled.
- [ ] Implementation plan with effort tags (S / M / L) and ordered so the
      design system lands first, then shells, then per-role screens.

---

*MG Work — Design prompt v1.0 — for use with Claude design generation
agents. Hand back the output as a single Markdown document; we'll merge it
into `docs/design-system.md` and start implementing in order.*
