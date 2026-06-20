# AsanaoConnect — Go-Live Checklist

Living tracker for everything remaining before live / production.
Tick items as they land. **Last updated: 2026-06-16.**

**Status:** LIVE in prod (`mgwork-seven.vercel.app`, deploy `3d1cc7a` = success), feature-complete, gated on the items below. Not yet open to real users.

Legend: `[ ]` todo · `[x]` done · **(eng)** engineering · **(owner)** your account/credential action · `blocker` / `major` / `minor` = launch severity.

---

## 0. Data residency (LOCKED: self-host Supabase on MRU)

> All user data on a Mauritius-hosted, **self-hosted Supabase** stack (Docker), single region for every user. **App stays on Vercel — data-at-rest residency: only Postgres + Storage move to MRU.** Keeps Prisma + `supabase-js`; minimal app code change, the real work shifts to infra/ops you now own.

- [x] Decide MRU target → **self-host Supabase on MRU** (Prisma + `supabase-js` retained)
- [x] Residency scope → **data-at-rest only: app stays on Vercel, Postgres + Storage in MRU**
- [ ] Provision the MRU box: **cloud.mu Tier 6 — 8 vCore / 16 GB RAM / 512 GB SSD, KVM, unmetered, ~Rs3,299/mo** (~$72); add the backup/snapshot add-on; static IP, domain + TLS — `blocker` **(owner)**
- [ ] Deploy self-hosted Supabase (`docker compose`): Postgres + Storage API + Kong + Supavisor pooler; **trim unused services** (GoTrue/Auth — you use Clerk; Realtime; Edge Functions; Logflare/Vector); rotate ALL default secrets (JWT secret, anon + service-role keys, DB + dashboard passwords); lock the network (firewall, no public Postgres port, Studio behind auth) — `blocker` **(eng + owner)**
- [ ] Repoint app env: `DATABASE_URL` + `DIRECT_URL` → MRU Postgres (via Supavisor); `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` → the self-hosted instance — `blocker` **(eng)**
- [ ] Run schema + buckets on the new instance: `prisma migrate deploy`, then `supabase/buckets_2026-06-11_disputes_avatars.sql` (avatars + dispute-attachments) against self-hosted — `blocker` **(eng)**
- [ ] Mitigate Vercel↔MRU latency (~150–250 ms RTT): route Prisma through the Supavisor pooler; minimize queries per request (batch with `Promise.all`, kill N+1); cache read-heavy/global queries — `major` **(eng)**
- [ ] Own the ops Supabase Cloud gave you for free: automated backups + PITR (WAL archiving / scheduled `pg_dump` + cloud.mu snapshots), uptime monitoring + alerts, OS/Postgres security patching — `major` **(eng + owner)**
- [ ] Per-processor PII reconciliation — residency ≠ just the DB. Decide what's acceptable for each external processor holding user PII abroad:
  - [ ] Clerk (auth identity)
  - [ ] Sentry (error payloads)
  - [ ] Anthropic (document content sent for AI)
  - [ ] Brevo (email + contact data)
  - [ ] Vercel (compute) — data-at-rest is now in MRU, but PII still **transits + is processed** in Vercel functions (US/EU); confirm that satisfies the requirement (data-at-rest vs data-in-use)

### Compliance & incorporation (legal track — counsel)

> The MRU box is residency **posture**, not compliance **done**. Both DPAs (Mauritius 2017, Madagascar 2014-038) are transfer-restriction regimes, not localization mandates — so the data still goes abroad in use, and only the items below close that gap. These gate launch.

- [ ] Send the counsel brief (`docs/asanaoconnect-counsel-brief.pdf`) + engage counsel for incorporation **and** the DP opinion — `blocker` **(owner)**
- [ ] Confirm the residency requirement's **driver** in writing (law / client-or-gov contract / positioning) — decides if data-at-rest suffices; a contract requiring in-country **processing** would force compute off Vercel (re-platform, planning-team job) — `blocker` **(owner)**
- [ ] Incorporate the Mauritius entity — private company limited by shares (**"Ltd"/"Ltée"**, NOT SARL) → becomes the data controller — `blocker` **(owner + counsel)**
- [ ] After incorporation, fill legal-entity values (BRN, capital, director, registered address, date) in `lib/legal-entity.ts` → also closes the public-pages placeholder blocker (dup of §B) — `blocker` **(owner → eng)**
- [ ] Register the controller with the Mauritius Data Protection Commissioner (+ DPO if required) — `blocker` **(owner + counsel)**
- [ ] Madagascar/CMIL formalities: declaration/authorization for processing Malagasy residents' data + the transfer to Mauritius; local representative if required — `blocker` **(owner + counsel)**
- [ ] Cross-border transfer safeguards: DPAs / standard clauses with each abroad processor (Vercel/Clerk/Anthropic/Sentry US; Brevo EU) — `blocker` **(owner + eng)**
- [ ] Signup consent + privacy policy covering cross-border processing for both jurisdictions (per counsel wording) — `blocker` **(eng)**
- [ ] Anthropic passport/visa **image** flow — sharpest PII exposure: specific consent / DPIA / or rework before AI doc-analysis goes live — `blocker` **(owner + eng)**

### Runbook — self-host Supabase on cloud.mu

Target: cloud.mu Tier 6 (8 vCore / 16 GB / 512 GB, KVM), Ubuntu 22.04 LTS. Pick a host domain, e.g. `supabase.asanao.mu`. App stays on Vercel.

Ready-made configs: **`infra/mru-supabase/`** — `nginx-stream.conf` (Postgres TLS), `backup.sh` (nightly pg_dump), `env.template` (box + Vercel env).

**1 — Provision + harden**
- Order Tier 6, Ubuntu 22.04, attach SSH key. Create a sudo user; disable root + password SSH (`PermitRootLogin no`, `PasswordAuthentication no`).
- `ufw`: allow `22, 80, 443, 5432, 6543`; deny the rest. (80/443 = Storage/REST via Kong + Let's Encrypt; 5432/6543 = Postgres for Vercel — guarded by TLS + creds, steps 3/6.)
- `apt install fail2ban unattended-upgrades` (auto security patching is your job now).

**2 — Docker**
- `curl -fsSL https://get.docker.com | sh`; add the user to the `docker` group.

**3 — DNS + TLS**
- A record `supabase.asanao.mu` → box IP.
- Caddy reverse proxy `:443 → 127.0.0.1:8000` (Kong), auto Let's Encrypt — this serves `NEXT_PUBLIC_SUPABASE_URL` (Storage API).
- Postgres TLS: drop in `infra/mru-supabase/nginx-stream.conf` (top-level `stream` block) — terminates TLS with the LE cert, forwards public `:6543`/`:5432` to the pooler/db. **Bind the `db` + `supavisor` containers to `127.0.0.1` on alt ports (5433 / 6544)** (edit their `ports:` in `supabase/docker/docker-compose.yml`) so nginx owns the public ports. (Alt: native Postgres SSL.)

**4 — Deploy Supabase**
- `git clone --depth 1 https://github.com/supabase/supabase`; `cd supabase/docker`; `cp .env.example .env`.
- Set secrets in `.env`: `POSTGRES_PASSWORD=$(openssl rand -hex 24)`, `JWT_SECRET=$(openssl rand -hex 32)`, then `ANON_KEY` + `SERVICE_ROLE_KEY` (JWTs signed with `JWT_SECRET`; roles `anon` / `service_role`, `iss: supabase`, long exp — use Supabase's key generator), `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`. Set `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL = https://supabase.asanao.mu`. Note `POOLER_TENANT_ID`.
- Optional RAM trim (not needed at 16 GB): disable `analytics`, `vector`, `functions`, `realtime`, `imgproxy` (unused — Clerk + Prisma).
- `docker compose up -d`; confirm `docker compose ps` all healthy.

**5 — Schema + buckets** (run on the box vs localhost — fast, avoids exposing 5432 for migration)
- `DIRECT_URL=postgresql://postgres:<pw>@127.0.0.1:5432/postgres npx prisma migrate deploy`
- `psql` the repo's `supabase/buckets_2026-06-11_disputes_avatars.sql` (avatars + dispute-attachments).

**6 — Vercel env diff** (Project → Settings → Environment Variables → Production; template: `infra/mru-supabase/env.template`)
```
DATABASE_URL = postgresql://postgres.<POOLER_TENANT_ID>:<pw>@supabase.asanao.mu:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL   = postgresql://postgres:<pw>@supabase.asanao.mu:5432/postgres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL      = https://supabase.asanao.mu
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon JWT>
SUPABASE_SERVICE_ROLE_KEY     = <service-role JWT>
```
- `DATABASE_URL` MUST be the Supavisor **transaction pooler (6543)** with `pgbouncer=true` — Vercel serverless opens many short-lived connections and will exhaust raw Postgres otherwise.
- If `vercel.json` keeps `prisma migrate deploy` in `buildCommand`, `DIRECT_URL` (5432) must be reachable from Vercel; else run migrations on-box (step 5) and drop them from the build.

**7 — Backups + monitoring**
- cloud.mu scheduled snapshots **+** nightly `pg_dump` via `infra/mru-supabase/backup.sh` (cron + off-box copy); **test a restore once**.
- Uptime check on `https://supabase.asanao.mu/rest/v1/` and the 6543 pooler.

**8 — Smoke test** → deploy Vercel, create a user + upload an avatar, confirm the row in MRU Postgres and the file in the MRU bucket; one GDPR export round-trip.

**Security note:** 5432/6543 are internet-exposed because Vercel egress IPs are dynamic — TLS + a strong password are the only guard. For defense-in-depth, buy Vercel static-egress and IP-allowlist the box.

---

## A. Engineering (no owner inputs — buildable now)

- [x] Fix red CI (PR #9) — was NOT a stale lockfile: npm10(CI)-vs-npm11(local) tree mismatch, plus an unmasked Clerk-stub-key prerender failure once `npm ci` passed. Fixed by CI→Node 24 + a format-valid dummy Clerk key. Lockfile unchanged. `unit`+`drift-check` green; `lint-typecheck-build` verified by clean local build (82/82 pages). — `blocker` **(eng)**
- [ ] Make CI a real merge gate once green; pin CI Node/npm to match local — `minor` **(eng)**
- [ ] Replace enterprise dashboard placeholders in `app/enterprise/page.tsx` (avgDays=11, days=47, "14 new matches", 142/9) → real Prisma aggregates or honest empty-state — `major` **(eng)**
- [ ] Wire the 4 dead buttons (build real actions): enterprise Export · staff Claim-Next · staff Advanced-Filters · admin New-Dispute · dispute Filter; plus candidate-browse filter chips — `minor` **(eng)**
- [x] Swap email transport Resend → Brevo (PR #10) — `lib/resend.ts`→`lib/email/client.ts`, Brevo REST via `fetch` (no new dep), `resend` dropped, inert without key, +unit test. **MANUAL:** update `.env.example` `RESEND_API_KEY`→`BREVO_API_KEY` (agent blocked from `.env*`). — `major` **(eng)**
- [ ] Merge PR-B env preflight (`860829b`) after section B env vars are set; update its required-var list for regional DBs + Brevo — `blocker` **(eng)**

---

## B. Owner actions (your accounts/credentials — gate go-live)

- [ ] Fund Anthropic account (key set in Vercel, balance is zero — all AI dormant until funded) — `blocker` **(owner)**
- [ ] Provision Upstash Redis + set both env vars — **do before funding Anthropic** (cost-abuse exposure without cross-instance rate limiting) — `major` **(owner)**
- [ ] Clerk Production instance — prod runs a Development instance (`*.clerk.accounts.dev`); create prod instance on domain, rename app, swap both Clerk keys in Vercel — `blocker` **(owner)**
- [ ] Supply legal-entity values — replace 5 `__PLACEHOLDER__` in `lib/legal-entity.ts` (Mauritius BRN, capital, director, Port-Louis address, incorporation date) — `blocker` **(owner)**
- [ ] Configure Brevo — create account, set `BREVO_API_KEY`, verify sender-domain DNS (SPF/DKIM) — `major` **(owner)**
- [ ] Set all required Vercel Production env vars (now incl. MG + MU DB/storage creds and `BREVO_API_KEY`) — `blocker` **(owner)**

---

## C. Pre-launch verification gate (after 0 + A + B)

- [ ] Deploy, then smoke-test on prod:
  - [ ] Clerk login with prod keys (no dev badge)
  - [ ] Create a user → confirm data lands in the MRU store (not Supabase Cloud)
  - [ ] Avatar + dispute-attachment upload (regional bucket)
  - [ ] GDPR export + deletion-request → `/admin/pending-deletions`
  - [ ] One AI call returns a real answer
  - [ ] One Brevo email delivered
  - [ ] Privacy page shows real legal entity
- [ ] Watch Sentry + rate-limit logs + Anthropic spend during the first session

---

## D. Post-launch backlog (not blockers)

- [ ] Meta channels (WhatsApp/Messenger): `META_*` vars + App Review (2–6 wk lead — start now); UI inert until approved
- [ ] PDF document analysis: wired and inert; activates automatically once Anthropic is funded
- [ ] Enterprise preselect/skip "Path B"
- [ ] E2E suite runnable in CI
- [ ] Widen test-coverage scope (Wave-2 lib modules)

---

## Out of scope (dropped)

- ~~Malagasy (MG) translations~~ — dropped; MG stays hidden in the switcher, FR/EN launch unaffected.

---

**Critical path:** workstream **0** has two tracks — an **infra track** (provision cloud.mu Tier 6 → deploy trimmed self-hosted Supabase → repoint env → migrate; app code barely changes) and a **legal track** (counsel: incorporate + DP opinion + transfer safeguards + consent). The legal track is the true launch gate — the box alone is not "compliant." Gating risks: ops ownership (backups/PITR/patching), Vercel↔MRU latency, and the data-in-use compliance nuance (PII still processed on Vercel) · A ≈ half a day · B = your accounts. Digest PDF (`docs/asanaoconnect-digest-2026-06-16.pdf`) still references Supabase Cloud — regenerate once MRU is stood up.
