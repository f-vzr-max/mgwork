# MG Work — Smoke Test Runbook

Walk these in order. For each row: do the action, mark `Result` as `pass`, `fail (note)`, or `n/a`. When done, hand back this file (or just paste the table back).

**Setup before starting:**
- Dev server running at http://localhost:3000 (`npm run dev` or `npm run dev:smoke`)
- Smoke seed data inserted (`npm run seed:smoke` — already done)
- One real Clerk account you can sign up with — use a real email since Clerk sends verification

**Note on roles:** Seeded users have synthetic `clerkId`s and CANNOT log in via Clerk. To exercise admin/staff flows, sign up real Clerk accounts and have an admin manually set their `publicMetadata.role` in the Clerk dashboard:
- `SUPER_ADMIN` for the admin tests (rows 30–40)
- `STAFF_DOCUMENTS` for staff document queue (rows 22–25)
- `STAFF_FOLLOWUP` for followup (rows 26–28)

If you don't want to set up multiple Clerk accounts, skip those rows (mark `n/a`) and we'll cover them in the next round once you have test users.

---

## Public + auth

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 1 | none | Visit `/` | Landing page renders. Links to `/sign-in` and `/sign-up` work. | |
| 2 | none | Visit `/sign-up` | Clerk sign-up widget renders. | |
| 3 | none | Sign up with a fresh email | Email verification flow → land on `/onboarding`. | |
| 4 | none | Visit `/admin` while signed-out | Middleware redirects to `/sign-in`. | |

## Onboarding

Make the new user a CANDIDATE first: in Clerk dashboard set `{ "role": "CANDIDATE" }`, then refresh `/onboarding`.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 5 | candidate | Refresh `/onboarding` after role set | Routes to `/onboarding/candidate`. | |
| 6 | candidate | Step 1 (Identity) — fill names, DOB, city, phone | "Next" advances to languages step. | |
| 7 | candidate | Step 2 (Languages) — set FR=80, EN=60 | "Next" advances. | |
| 8 | candidate | Step 3 (Skills) — add 3 tags (e.g., bartender, english, cocktails) | "Next" advances. | |
| 9 | candidate | Step 4 (Sectors) — pick "Hospitality" | "Next" advances. | |
| 10 | candidate | Step 5 (CV) — skip (or upload an image) | "Submit" button enabled. | |
| 11 | candidate | Click submit on final step | POST `/api/candidates` returns 200, redirects to `/candidate`. | |
| 12 | candidate | Open Prisma Studio (`npm run prisma:studio`) | New `Candidate` row exists, profile populated. | |

For an enterprise pass: sign up a second account, set role `ENTERPRISE`, walk steps 13–14.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 13 | enterprise | Walk 3-step enterprise onboarding | POST `/api/enterprises` 200, lands on `/enterprise`. | |
| 14 | enterprise | Open Prisma Studio | New `Enterprise` row, plan=FREE. | |

## Candidate — main flows

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 15 | candidate | Visit `/candidate` | Dashboard renders, profile-completion stat shows real number (not hardcoded 0). | |
| 16 | candidate | Visit `/candidate/documents` → "Upload" → choose a small PDF, type=PASSPORT | Doc appears in list as PENDING. | |
| 17 | candidate | Click the doc's "view" button | New tab opens with signed URL preview (PDF inline). | |
| 18 | candidate | Open the chat drawer from `/candidate` (chat icon in sidebar/tab-bar, or visit `/candidate?openChat=1`) → send "I'm a chef with 5 years experience" | Streamed Claude reply appears. After 5s, refresh — Candidate.skills should include "chef". | |
| 19 | candidate | Visit `/candidate/matches` | Lists ranked offers (or empty if you skipped enterprise + offer steps). | |
| 20 | candidate | Visit `/candidate/applications` | Empty list (no applications yet) — no crash. | |
| 21 | candidate | GET `/api/me/data-export` | JSON download with profile + documents (no fileUrl). | |

## Staff — Documents

Sign up a third Clerk account, set role `STAFF_DOCUMENTS`.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 22 | staff_docs | Visit `/staff/documents` | Pending queue lists doc from row 16. StatsBar at top shows numbers. | |
| 23 | staff_docs | Click row → review screen loads | InlineScanViewer renders (iframe with signed URL). | |
| 24 | staff_docs | Click "Approve" | Status flips to APPROVED. Row disappears from queue. | |
| 25 | staff_docs | Upload a 2nd doc (in Prisma Studio create another PENDING doc, refresh queue), then "Reject" with reason >10 chars | Status flips to REJECTED with rejectionNote. | |

## Staff — Followup

Sign up a 4th account or change the staff_docs account's role to `STAFF_FOLLOWUP`.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 26 | staff_followup | Visit `/staff/followup` | List renders (empty if no DEPLOYED applications). | |
| 27 | staff_followup | (Optional) In Prisma Studio set an Application.status=DEPLOYED, refresh | Application appears under its enterprise group. | |
| 28 | staff_followup | Open the application detail → fill intervention form → submit | Checkpoint row created, audit log written. | |

## Enterprise

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 29 | enterprise | Visit `/enterprise/offers` → "New offer" | Form renders. CTA enabled (under 3 ACTIVE offers). | |
| 30 | enterprise | Submit with title="Cook" sector=hospitality status=ACTIVE | POST `/api/offers` 200, redirects to offer detail. | |
| 31 | enterprise | View the offer detail page | Shortlist section visible. POST `/api/ai/match` triggers — top 5 candidates display with breakdown. | |
| 32 | enterprise | Visit `/enterprise/candidates` | Browse list, filter by sector=hospitality. | |
| 33 | enterprise | Visit `/enterprise/interviews` | Calendar grid renders, no scheduled interviews. | |
| 34 | enterprise | Try to create a 4th ACTIVE offer | Server returns 403 with upgrade-required message. | |

## Admin

Set role `SUPER_ADMIN` on the original account or a new one.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 35 | admin | Visit `/admin` | KPI cards show real counts (not 0). | |
| 36 | admin | Visit `/admin/users` → search by email | List renders with pagination. Actions dropdown works. | |
| 37 | admin | Visit `/admin/invoices` → "New invoice" | Form renders, submit creates invoice for the seeded enterprise. | |
| 38 | admin | Mark the new invoice as paid | Status flips to PAID. Audit log shows `invoice.mark_paid`. | |
| 39 | admin | Visit `/admin/audit` | Recent audit log entries render. Filter by action prefix works. | |
| 40 | admin | Visit `/admin/matching-config` → adjust a slider → save | PUT `/api/admin/matching-config` 200. Refresh — values persist. | |
| 41 | admin | Visit `/admin/feature-flags` → toggle one | Toggle persists across refresh. | |
| 42 | admin | Visit `/admin/i18n` | Translation rows from seed render (or empty). | |

## Cron endpoints

Use curl or Postman. Replace `<CRON_SECRET>` with the value from `.env.local`.

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 43 | n/a | `curl -X POST http://localhost:3000/api/cron/expiry-alerts -H "Authorization: Bearer <CRON_SECRET>"` | 200 with JSON summary `{ scanned, alerted: { d30, d15, d7 } }`. | |
| 44 | n/a | Same without auth header | 401. | |
| 45 | n/a | `curl -X POST .../api/cron/monthly-checkin -H "Authorization: Bearer <CRON_SECRET>"` | 200 with summary. | |
| 46 | n/a | `curl -X POST .../api/cron/monthly-report -H "Authorization: Bearer <CRON_SECRET>"` | 200 with per-enterprise count. | |

## Cross-cutting

| # | Role | Action | Expected | Result |
|---|---|---|---|---|
| 47 | any signed-in | Click language switcher in sidebar → switch to EN | UI text flips to English. POST `/api/me/language` 200. | |
| 48 | any signed-in | Switch to MG | UI shows `[MG-TODO]` placeholders (expected). | |
| 49 | none | Visit a deeply protected route while signed-out (e.g., `/admin/audit`) | Redirects to `/sign-in`. | |
| 50 | n/a | Open browser devtools → Network tab → check headers on any page | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all present. | |

---

## Done?

When the table is filled out, paste it back to me. I'll triage:
- **P0** (journey blocked) → I fix inline immediately
- **P1** (broken feature, ≤5 lines to fix) → I fix inline
- **P1+** (broken, >5 lines) / **P2** (cosmetic) / **P3** (out-of-scope) → I queue in [smoke-test-followups.md](smoke-test-followups.md)

If anything 500s with a stack trace, copy the trace into the Result column or screenshot it.
