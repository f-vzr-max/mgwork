# Phase 1 — Foundations

**Goal**: Project scaffold, auth, database, CI/CD, design system live  
**Target week**: 2026-05-04  
**Deliverable**: Authenticated shell with role routing, empty dashboards, DB connected

---

## Immediate Next Actions

> Execute in order. Start here when opening VS Code.

### CRITICAL

- [ ] **1.** Create GitHub repository `mgwork` + set branching strategy (main / develop / feature/*)
- [ ] **2.** Scaffold Next.js app: `npx create-next-app@latest mgwork --typescript --tailwind --app --src-dir false`
- [ ] **3.** Create Supabase project → copy `SUPABASE_URL` and keys to `.env.local`
- [ ] **4.** Install and configure Clerk → set up roles in Clerk dashboard → add env vars
- [ ] **5.** Install Prisma: `npm install prisma @prisma/client` → write full schema (roadmap §5) → `npx prisma migrate dev --name init`
- [ ] **6.** Install shadcn/ui: `npx shadcn@latest init` → add base components

### HIGH

- [ ] **7.** Configure Tailwind design tokens: blue `#1A3C6E`, green `#007B55`, red `#C0392B`, white `#FFFFFF`
- [ ] **8.** Build role-based middleware (`middleware.ts` with Clerk + route matchers per role)
- [ ] **9.** Build role-based layouts: sidebar navigation dynamic per role
- [ ] **10.** Get Anthropic API key → add to `.env.local`
- [ ] **11.** Connect Vercel to GitHub repo → enable preview deployments from `develop` branch

### MEDIUM

- [ ] **12.** Get Meta Cloud API access (WhatsApp Business)
- [ ] **13.** Configure Resend account + domain verification → set up welcome and alert email templates
- [ ] **14.** Set up Sentry project → add `SENTRY_DSN` to env → wrap app with Sentry

---

## Full Phase 1 Checklist

- [ ] Initialize Next.js 14 project with TypeScript + Tailwind CSS + shadcn/ui
- [ ] Configure ESLint, Prettier, path aliases (`@/`)
- [ ] Create Supabase project: PostgreSQL + Storage buckets + RLS policies
- [ ] Write full Prisma schema (roadmap §5) + run initial migration
- [ ] Install and configure Clerk (roles: CANDIDATE, ENTERPRISE, ADMIN, STAFF_FOLLOWUP, STAFF_DOCUMENTS)
- [ ] Role-based middleware: protect routes per role
- [ ] Implement design system: color tokens (white/blue/green/red), typography, base components
- [ ] Role-based layouts: dynamic sidebar navigation per role
- [ ] Set up GitHub repo + branching strategy (main / develop / feature/*)
- [ ] Configure GitHub Actions: lint + type-check + build on PR
- [ ] Connect Vercel: auto-deploy from develop (preview) + main (production)
- [ ] Integrate Sentry error tracking + Vercel Analytics
- [ ] Configure Resend for transactional email
