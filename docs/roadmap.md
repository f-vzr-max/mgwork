# MG Work — Technical Roadmap v1.0

> **Matchmaking platform connecting Malagasy candidates with Mauritian companies**
> Built with Claude on VS Code | From conception to production

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Tech Stack](#2-tech-stack)
3. [User Roles & Access](#3-user-roles--access)
4. [Functional Modules](#4-functional-modules)
5. [Database Schema](#5-database-schema)
6. [Development Phases](#6-development-phases)
7. [Security & Compliance](#7-security--compliance)
8. [Monetization Model](#8-monetization-model)
9. [Repository Structure](#9-repository-structure)
10. [Immediate Next Actions](#10-immediate-next-actions)

---

## 1. Project Vision

MG Work is a B2B2C matchmaking platform connecting **Mauritian companies** with **qualified Malagasy candidates**, built to international HR and legal compliance standards.

### Core Pillars

- **Pure marketplace** with monthly follow-up and MG Work intervention capability in case of disputes
- **AI-powered** matching, profile creation, CV extraction, interview simulation, and post-deployment tracking
- **Mobile-first** for candidates, **web-first** for companies
- **Social-first entry**: candidates interact first via TikTok, Facebook Messenger, Instagram, WhatsApp — the LLM acts as a bridge to the platform
- **All sectors** covered from day one
- **Three languages**: French (primary), English, Malagasy

### Payments

> Stripe is **not used**. Payments are handled:
> - **Mauritius side**: bank wire transfer (virement bancaire)
> - **Madagascar side**: mobile money (MVola, Orange Money, Airtel Money)
>
> Payment tracking and invoicing are managed manually by Admin staff via the admin dashboard.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack, SSR, API Routes |
| **Frontend** | React + TypeScript | UI components |
| **Styling** | Tailwind CSS + shadcn/ui | Design system (white/blue/green/red) |
| **Database** | PostgreSQL via Supabase | Structured data, RLS, audit logs |
| **ORM** | Prisma | Typed schema, migrations |
| **Auth** | Clerk | JWT, role-based access, MFA, social login |
| **File Storage** | Supabase Storage (encrypted) | Passports, medical docs, CVs, scans |
| **AI / LLM** | Anthropic Claude API | Matching, CV extraction, chat, simulation |
| **Social Messaging** | Meta Cloud API + WhatsApp Business API | Candidate entry via social platforms |
| **OCR / Vision** | Claude Vision API | CV reading from image/PDF/Word |
| **Hosting** | Vercel (Edge) | Frontend + serverless API |
| **CI/CD** | GitHub Actions + Vercel Deploy | Auto tests + continuous deployment |
| **Monitoring** | Sentry + Vercel Analytics | Errors, performance, uptime |
| **Email** | Resend + React Email | Notifications, document expiry alerts |
| **Payments** | Manual (wire + mobile money) | Tracked via admin dashboard |

### Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Anthropic
ANTHROPIC_API_KEY=

# Meta / WhatsApp
META_APP_ID=
META_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 3. User Roles & Access

```
SUPER_ADMIN
    └── ADMIN
         ├── STAFF_FOLLOWUP
         ├── STAFF_DOCUMENTS
         └── (extensible: STAFF_COMMERCIAL, STAFF_SUPPORT...)
ENTERPRISE
CANDIDATE
```

| Role | Access Scope | Primary Interface |
|------|-------------|-------------------|
| `SUPER_ADMIN` | Full system + config | Web admin dashboard |
| `ADMIN` | Users, disputes, KPIs, payments | Web admin dashboard |
| `STAFF_FOLLOWUP` | Monthly tracking of deployed employees | Web staff dashboard |
| `STAFF_DOCUMENTS` | Document validation queue | Web staff dashboard |
| `ENTERPRISE` | Job offers, candidate shortlist, interviews | Web enterprise dashboard |
| `CANDIDATE` | Profile, documents, matching, chat | Mobile-first + social chat |

---

## 4. Functional Modules

### 4.1 Candidate Module (Mobile-first)

- **Multi-channel entry**: TikTok / Messenger / Instagram / WhatsApp → LLM collects data and creates/updates profile
- **Unique persistent token** across platforms per candidate
- **CV extraction**: Claude Vision API reads PDF / Word / image → auto-generates standardized profile
- **Standardized profiles**: all candidates use the same structured format regardless of input source
- **Document wallet**: passport, medical authorization, work permit — stored encrypted in Supabase Storage
- **Expiry alerts**: automated notifications at 30 days / 15 days / 7 days before document expiry
- **Profile completeness score**: step-by-step guide to reach 100%
- **Language level test**: integrated FR / EN scoring powered by Claude
- **AI interview simulation**: role-specific questions + feedback before the real interview
- **Departure checklist**: interactive (flight, housing, emergency contacts, packing)
- **Country integration module**: practical life info about Mauritius (culture, law, daily life)
- **Monthly check-in**: in-app or via WhatsApp chat (LLM-powered)
- **Emergency contact in-app**: accessible at all times post-deployment

### 4.2 Enterprise Module (Web-first)

- **Company profile**: incorporation details, registered address, accreditations, KYC verification
- **Job offer publishing**: freemium model (3 free active offers → paid plan)
- **AI shortlist**: top 5 recommended candidates per open position
- **Compatibility score**: 0–100% match with breakdown by criteria (skills, languages, mobility, sector, experience)
- **Proactive suggestions**: "This candidate matches your position X"
- **Recruitment history**: past placements + retention statistics
- **Pre-filled contract templates**: adapted per job type
- **Candidate rating**: post-interview notes (stored, visible to staff)
- **Integrated calendar + video interviews**: for cadre-level positions and above
- **Monthly automated report**: AI-generated summary of deployed employee status
- **Payment tracking panel**: records of wire transfers received / mobile money confirmations (manual)

### 4.3 Admin Dashboard

- **Global KPIs**: total candidates, companies, placements, revenue (manual), MRR equivalent
- **User management**: ban, manual verification, reset, impersonate
- **KYC override**: manual validation for candidates and companies
- **Dispute management**: intervention tools + history log
- **Matching engine config**: adjust weight of each matching criterion
- **Revenue tracking**: placement commissions, subscription records (wire + mobile money)
- **Invoice management**: generate and track invoices manually per client
- **Full audit trail**: every sensitive action logged with userId, IP, timestamp
- **Global document expiry alerts**: overview of all expiring documents across all users
- **Language / translation management**: FR / EN / MG content strings
- **System config**: feature flags, platform settings

### 4.4 Staff Dashboard — Follow-up

- **Active employees list**: per company, with checkpoint status
- **Automated alerts**: expired document, missed monthly check-in
- **Interaction history**: candidate ↔ company communication log
- **Intervention form**: structured report for disputes or field issues
- **Internal notes**: per-file private notes (staff-only)
- **Relance calendar**: scheduled follow-up reminders
- **Personal stats**: assigned files, resolution rate

### 4.5 Staff Dashboard — Documents

- **Validation queue**: FIFO + priority flag, documents awaiting review
- **Integrated scan viewer**: zoom, rotate, multi-page support
- **Validate / reject**: with structured rejection reason
- **Validation history**: per agent with timestamp
- **Expiry alerts**: 30 / 15 / 7 days before expiry per document
- **Personal stats**: documents processed, average processing time

---

## 5. Database Schema

### Prisma Schema (PostgreSQL via Supabase)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  ADMIN
  STAFF_FOLLOWUP
  STAFF_DOCUMENTS
  ENTERPRISE
  CANDIDATE
}

enum DocumentType {
  PASSPORT
  MEDICAL_AUTHORIZATION
  WORK_PERMIT
  VISA
  INCORPORATION_CERTIFICATE
  OTHER
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

enum ApplicationStatus {
  APPLIED
  SHORTLISTED
  INTERVIEW_SCHEDULED
  INTERVIEW_DONE
  OFFER_MADE
  DEPLOYED
  COMPLETED
  REJECTED
}

enum OfferStatus {
  DRAFT
  ACTIVE
  PAUSED
  CLOSED
}

enum CheckpointStatus {
  OK
  ALERT
  INTERVENTION_REQUIRED
}

enum SocialPlatform {
  WHATSAPP
  MESSENGER
  INSTAGRAM
  TIKTOK
  IN_APP
}

enum Language {
  FR
  EN
  MG
}

model User {
  id          String    @id @default(cuid())
  clerkId     String    @unique
  email       String    @unique
  role        Role
  lang        Language  @default(FR)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  candidate   Candidate?
  enterprise  Enterprise?
  auditLogs   AuditLog[]
  staffNotes  StaffNote[]
}

model Candidate {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  firstName       String
  lastName        String
  dateOfBirth     DateTime?
  nationality     String    @default("MG")
  phone           String?
  city            String?
  profileScore    Int       @default(0) // 0–100
  langScoreFR     Int?
  langScoreEN     Int?
  cvFileUrl       String?
  bio             String?
  skills          String[]
  sectors         String[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  documents       Document[]
  applications    Application[]
  conversations   Conversation[]
  checkpoints     Checkpoint[]
}

model Enterprise {
  id                  String    @id @default(cuid())
  userId              String    @unique
  user                User      @relation(fields: [userId], references: [id])
  companyName         String
  registrationNumber  String?
  sector              String?
  address             String?
  contactName         String?
  contactPhone        String?
  verified            Boolean   @default(false)
  plan                String    @default("FREE") // FREE | STARTER | PRO
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  jobOffers           JobOffer[]
  documents           Document[]
  invoices            Invoice[]
}

model Document {
  id            String          @id @default(cuid())
  type          DocumentType
  fileUrl       String
  status        DocumentStatus  @default(PENDING)
  expiresAt     DateTime?
  rejectionNote String?
  verifiedAt    DateTime?
  verifiedById  String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  candidateId   String?
  candidate     Candidate?      @relation(fields: [candidateId], references: [id])
  enterpriseId  String?
  enterprise    Enterprise?     @relation(fields: [enterpriseId], references: [id])
}

model JobOffer {
  id            String      @id @default(cuid())
  enterpriseId  String
  enterprise    Enterprise  @relation(fields: [enterpriseId], references: [id])
  title         String
  description   String
  sector        String
  location      String      @default("Mauritius")
  slots         Int         @default(1)
  status        OfferStatus @default(DRAFT)
  requirements  String[]
  langRequired  String[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  applications  Application[]
  matchings     Matching[]
}

model Application {
  id            String            @id @default(cuid())
  candidateId   String
  candidate     Candidate         @relation(fields: [candidateId], references: [id])
  jobOfferId    String
  jobOffer      JobOffer          @relation(fields: [jobOfferId], references: [id])
  status        ApplicationStatus @default(APPLIED)
  aiScore       Int?              // 0–100 compatibility score
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  interviews    Interview[]
  checkpoints   Checkpoint[]
}

model Matching {
  id            String    @id @default(cuid())
  candidateId   String
  jobOfferId    String
  jobOffer      JobOffer  @relation(fields: [jobOfferId], references: [id])
  score         Int       // 0–100
  criteria      Json      // breakdown per criterion
  createdAt     DateTime  @default(now())
}

model Interview {
  id              String      @id @default(cuid())
  applicationId   String
  application     Application @relation(fields: [applicationId], references: [id])
  scheduledAt     DateTime
  type            String      // VIDEO | IN_PERSON | PHONE
  videoUrl        String?
  status          String      @default("SCHEDULED") // SCHEDULED | DONE | CANCELLED
  enterpriseNotes String?
  candidateNotes  String?
  createdAt       DateTime    @default(now())
}

model Checkpoint {
  id              String          @id @default(cuid())
  applicationId   String
  application     Application     @relation(fields: [applicationId], references: [id])
  candidateId     String
  candidate       Candidate       @relation(fields: [candidateId], references: [id])
  staffId         String?
  date            DateTime        @default(now())
  status          CheckpointStatus @default(OK)
  notes           String?
  interventionLog String?
}

model StaffNote {
  id            String    @id @default(cuid())
  staffId       String
  staff         User      @relation(fields: [staffId], references: [id])
  resourceType  String    // candidate | enterprise | application
  resourceId    String
  note          String
  createdAt     DateTime  @default(now())
}

model Conversation {
  id            String          @id @default(cuid())
  candidateId   String
  candidate     Candidate       @relation(fields: [candidateId], references: [id])
  platform      SocialPlatform
  externalId    String?         // platform-side thread/user ID
  history       Json            // array of { role, content, timestamp }
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([candidateId, platform])
}

model Invoice {
  id              String      @id @default(cuid())
  enterpriseId    String
  enterprise      Enterprise  @relation(fields: [enterpriseId], references: [id])
  amount          Float
  currency        String      @default("MUR") // MUR or MGA
  paymentMethod   String      // WIRE | MOBILE_MONEY
  reference       String?
  status          String      @default("PENDING") // PENDING | PAID | OVERDUE
  issuedAt        DateTime    @default(now())
  paidAt          DateTime?
  notes           String?
}

model AuditLog {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  action        String
  resourceType  String
  resourceId    String?
  ipAddress     String?
  metadata      Json?
  createdAt     DateTime  @default(now())
}
```

---

## 6. Development Phases

### Phase 1 — Foundations (Week 1)

**Goal**: Project scaffold, auth, database, CI/CD, design system live

- [ ] Initialize Next.js 14 project with TypeScript + Tailwind CSS + shadcn/ui
- [ ] Configure ESLint, Prettier, path aliases (`@/`)
- [ ] Create Supabase project: PostgreSQL + Storage buckets + RLS policies
- [ ] Write full Prisma schema (see Section 5) + run initial migration
- [ ] Install and configure Clerk (roles: CANDIDATE, ENTERPRISE, ADMIN, STAFF_FOLLOWUP, STAFF_DOCUMENTS)
- [ ] Role-based middleware: protect routes per role
- [ ] Implement design system: color tokens (white/blue/green/red), typography, base components
- [ ] Role-based layouts: dynamic sidebar navigation per role
- [ ] Set up GitHub repo + branching strategy (main / develop / feature/*)
- [ ] Configure GitHub Actions: lint + type-check + build on PR
- [ ] Connect Vercel: auto-deploy from develop (preview) + main (production)
- [ ] Integrate Sentry error tracking + Vercel Analytics
- [ ] Configure Resend for transactional email

**Deliverable**: Authenticated shell with role routing, empty dashboards, DB connected

---

### Phase 2 — Profiles & Documents (Week 2)

**Goal**: Full candidate and enterprise onboarding, document management, staff validation

- [ ] Candidate onboarding: multi-step form + profile completeness score (0–100%)
- [ ] CV extraction pipeline: upload file → Claude Vision API → extract structured data → pre-fill profile
- [ ] Support formats: PDF, Word (.docx), image (JPEG/PNG)
- [ ] Document wallet: upload, categorize, store encrypted in Supabase Storage
- [ ] Document expiry cron jobs (Vercel Cron): alert at 30d / 15d / 7d via Resend email
- [ ] Enterprise onboarding: company details + KYC upload + manual verification workflow
- [ ] Staff Dashboard — Documents: validation queue, scan viewer (zoom, rotate), approve/reject with reason
- [ ] Full audit trail: log all document actions (upload, approve, reject, view)
- [ ] Language level test: integrated FR / EN quiz scored by Claude API
- [ ] Standardized profile format: all profiles (regardless of input source) stored in same structure

**Deliverable**: Complete profiles both sides, document pipeline operational, staff docs dashboard live

---

### Phase 3 — AI Matching Engine (Week 3)

**Goal**: Intelligent matching, scoring, AI recommendations

- [ ] Matching engine: multi-criteria scoring algorithm
  - Skills overlap
  - Language levels (required vs candidate score)
  - Sector match
  - Mobility / availability
  - Experience level
  - Document completeness
- [ ] Compatibility score (0–100%) with per-criterion breakdown stored in `Matching` table
- [ ] Enterprise shortlist: top 5 candidates ranked per job offer
- [ ] Proactive suggestions: notify enterprise when a strong candidate registers matching their open positions
- [ ] AI profile enhancement: Claude suggests improvements to candidate profile text
- [ ] AI interview simulation: generates role-specific interview questions + evaluates candidate answers
- [ ] Admin panel: adjust matching criterion weights (sliders → stored in config table)
- [ ] Job offer publishing workflow: DRAFT → ACTIVE, freemium gate (3 free offers max)

**Deliverable**: Matching engine live, shortlist visible to enterprises, AI features integrated

---

### Phase 4 — Social Chat & LLM Bridge (Weeks 4)

**Goal**: Candidate entry via social platforms, persistent LLM-powered conversations

- [ ] WhatsApp Business API integration (Meta Cloud): receive + send messages
- [ ] Messenger / Instagram integration (Meta Cloud API)
- [ ] TikTok: deep link → redirect to WhatsApp or Messenger (no native API)
- [ ] Unique persistent token per candidate: link social conversation to platform profile
- [ ] LLM bridge: conversation with Claude collects candidate info → creates/updates profile via API
- [ ] Cross-platform conversation persistence: history stored in `Conversation.history` (JSONB)
- [ ] Webhook handling: Meta platform events → Next.js API route
- [ ] In-app chat interface: for candidates who prefer not to use social platforms
- [ ] Push notifications (candidate): application status updates, alerts, interview reminders
- [ ] Monthly check-in via WhatsApp: LLM sends structured check-in message → parses response → updates checkpoint

**Deliverable**: Full social entry funnel live, WhatsApp + Messenger operational, LLM bridge active

---

### Phase 5 — Interviews & Deployment Tracking (Weeks 5)

**Goal**: End-to-end placement workflow, post-deployment monitoring

- [ ] Integrated calendar: enterprise sets availability, candidate books slot
- [ ] Video interview embed: Daily.co or Whereby (iframe in platform)
- [ ] Post-interview workflow: enterprise rates candidate, candidate gives feedback
- [ ] Deployment tracking: once hired, candidate status → DEPLOYED
- [ ] Departure checklist: interactive checklist for candidate (flight, docs, housing, emergency contacts)
- [ ] Country integration module: static + AI-generated practical info about life in Mauritius
- [ ] Staff Dashboard — Follow-up: active deployed employees, checkpoint statuses, alert feed
- [ ] Monthly checkpoint automation: cron → check-in prompt to candidate → staff alert if no response in 48h
- [ ] Automated monthly report: Claude generates summary of deployed employee status → email to enterprise + staff
- [ ] Intervention workflow: staff can log field issues + escalate to admin

**Deliverable**: Full placement lifecycle operational, deployed employee tracking live

---

### Phase 6 — Monetization & Launch (Weeks 6)

**Goal**: Payment tracking, multilanguage, hardening, beta launch

- [ ] Invoice management system (admin): create, track, mark as paid (wire / mobile money)
- [ ] Freemium enforcement: 3 free offers cap → lock with upgrade prompt
- [ ] Subscription plans: STARTER / PRO — tracked manually, activated by admin after payment confirmation
- [ ] Placement commission tracking: admin logs commission per successful placement
- [ ] Revenue dashboard (admin): total revenue, pending invoices, placement commissions
- [ ] Full multilanguage: FR / EN / MG using `next-intl` or `i18next` + JSON translation files
- [ ] Language switcher: persistent per user (stored in DB), available on all screens
- [ ] End-to-end tests: Playwright covering critical user journeys (candidate onboarding, matching, document upload)
- [ ] Unit tests: Jest for matching engine, scoring, document expiry logic
- [ ] Security audit: RLS policies review, API route auth checks, file access validation
- [ ] Data Protection Act Mauritius 2017 compliance review
- [ ] Performance optimization: image optimization, lazy loading, API response caching
- [ ] Closed beta → open beta → production launch

**Deliverable**: Full platform live, all languages, payments tracked, tested and audited

---

## 7. Security & Compliance

### Infrastructure Security

- AES-256 encryption for all civil documents stored in Supabase Storage
- Row Level Security (RLS) on all Supabase tables: strict role isolation
- Automated KYC for candidates and enterprises (document verification workflow)
- Full audit trail: every sensitive action logged (userId, action, resourceType, resourceId, IP, timestamp)
- MFA mandatory for ADMIN and STAFF roles (Clerk)
- Rotating JWT tokens (Clerk handles rotation)
- HTTPS enforced + security headers (CSP, HSTS, X-Frame-Options)
- API rate limiting on all public routes (Next.js middleware)
- Separate storage buckets per document type with signed URLs (time-limited access)

### Legal Compliance

- **Data Protection Act Mauritius 2017**: primary compliance framework
- **GDPR alignment**: for credibility with international partners
- Explicit consent on data processing at registration
- Right to erasure: admin can delete all user data on request
- Data retention policy: audit logs retained 5 years minimum
- PII separated from operational data in schema design
- DPA (Data Processing Agreement) signed with Supabase, Vercel, Clerk, Anthropic

### Document Security Rules

- Documents only accessible via **signed URLs** (expire after 15 minutes)
- Only `STAFF_DOCUMENTS`, `ADMIN`, `SUPER_ADMIN` can view raw document files
- Candidates and enterprises can only see their own documents
- All document access events logged in `AuditLog`

---

## 8. Monetization Model

> Stripe is **not used**. All payments are tracked manually by Admin staff.

### Payment Methods

| Market | Method |
|--------|--------|
| Mauritius (enterprise) | Bank wire transfer (MUR) |
| Madagascar (candidate premium) | Mobile money: MVola, Orange Money, Airtel Money (MGA) |

### Plans & Products

| Product | Detail | Price Model |
|---------|--------|------------|
| **Free Enterprise** | 3 active job offers, basic matching | Free |
| **Starter Enterprise** | 10 offers, AI shortlist, interviews | Monthly wire |
| **Pro Enterprise** | Unlimited, priority matching, analytics | Annual wire |
| **Placement commission** | % of first monthly salary on contract signing | One-time wire |
| **Candidate Premium** | Boosted visibility + advanced AI coaching | Mobile money monthly |
| **Express document verification** | Priority validation within 24h | Mobile money one-time |
| **MG Work intervention** | Mediation for disputes (included in Pro / billed otherwise) | Wire / mobile money |

### Admin Payment Workflow

1. Enterprise requests plan upgrade or service
2. Admin generates invoice (via admin dashboard)
3. Enterprise pays by wire → sends transfer confirmation
4. Admin marks invoice as PAID → activates features manually
5. All tracked in `Invoice` table with reference number

---

## 9. Repository Structure

```
mgwork/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Login, register, onboarding flows
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── onboarding/
│   ├── (candidate)/              # Candidate dashboard (mobile-first)
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── documents/
│   │   ├── matches/
│   │   ├── applications/
│   │   └── chat/
│   ├── (enterprise)/             # Enterprise dashboard (web)
│   │   ├── dashboard/
│   │   ├── offers/
│   │   ├── candidates/
│   │   ├── interviews/
│   │   ├── deployed/
│   │   └── invoices/
│   ├── (admin)/                  # Admin dashboard
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── disputes/
│   │   ├── invoices/
│   │   ├── matching-config/
│   │   └── audit/
│   ├── (staff)/                  # Staff dashboards
│   │   ├── followup/
│   │   └── documents/
│   └── api/                      # API Routes (Node.js)
│       ├── webhooks/
│       │   └── meta/             # WhatsApp / Messenger webhook
│       ├── ai/
│       │   ├── extract-cv/       # CV extraction pipeline
│       │   ├── match/            # Matching engine
│       │   └── chat/             # LLM bridge
│       ├── documents/
│       ├── candidates/
│       ├── enterprises/
│       └── cron/                 # Vercel Cron endpoints
│           ├── expiry-alerts/
│           └── monthly-checkin/
│
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui base components
│   ├── layout/                   # Sidebar, header, footer
│   ├── candidate/                # Candidate-specific components
│   ├── enterprise/               # Enterprise-specific components
│   ├── admin/                    # Admin-specific components
│   ├── staff/                    # Staff-specific components
│   └── shared/                   # Cross-role components
│
├── lib/                          # Core utilities
│   ├── prisma.ts                 # Prisma client singleton
│   ├── supabase.ts               # Supabase client
│   ├── claude.ts                 # Anthropic Claude API client
│   ├── resend.ts                 # Email client
│   ├── matching.ts               # Matching algorithm
│   ├── scoring.ts                # Profile + compatibility scoring
│   └── utils.ts                  # Shared helpers
│
├── hooks/                        # Custom React hooks
│   ├── useProfile.ts
│   ├── useDocuments.ts
│   ├── useMatching.ts
│   └── useConversation.ts
│
├── middleware.ts                  # Clerk auth + role-based route protection
│
├── prisma/
│   ├── schema.prisma             # Full database schema (see Section 5)
│   └── migrations/
│
├── i18n/                         # Translations
│   ├── fr.json
│   ├── en.json
│   └── mg.json
│
├── types/                        # TypeScript global types
│   ├── candidate.ts
│   ├── enterprise.ts
│   └── api.ts
│
├── public/                       # Static assets
│   └── images/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint + type-check + build on PR
│       └── deploy.yml            # Vercel deploy on merge to main
│
├── .env.local                    # Local env variables (never commit)
├── .env.example                  # Template (commit this)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Immediate Next Actions

> Execute in order. Start here when opening VS Code.

### Priority: CRITICAL 🔴

- [ ] **1.** Create GitHub repository `mgwork` + set branching strategy (main / develop / feature/*)
- [ ] **2.** Scaffold Next.js app: `npx create-next-app@latest mgwork --typescript --tailwind --app --src-dir false`
- [ ] **3.** Create Supabase project → copy `SUPABASE_URL` and keys to `.env.local`
- [ ] **4.** Install and configure Clerk → set up roles in Clerk dashboard → add env vars
- [ ] **5.** Install Prisma: `npm install prisma @prisma/client` → write full schema (Section 5) → `npx prisma migrate dev --name init`
- [ ] **6.** Install shadcn/ui: `npx shadcn@latest init` → add base components

### Priority: HIGH 🟠

- [ ] **7.** Configure Tailwind design tokens: MG Work colors (blue `#1A3C6E`, green `#007B55`, red `#C0392B`, white `#FFFFFF`)
- [ ] **8.** Build role-based middleware (`middleware.ts` with Clerk + route matchers per role)
- [ ] **9.** Build role-based layouts: sidebar navigation dynamic per role
- [ ] **10.** Get Anthropic API key from [console.anthropic.com](https://console.anthropic.com) → add to env
- [ ] **11.** Connect Vercel to GitHub repo → enable preview deployments from `develop` branch

### Priority: MEDIUM 🟡

- [ ] **12.** Get Meta Cloud API access (WhatsApp Business): [developers.facebook.com](https://developers.facebook.com)
- [ ] **13.** Configure Resend account + domain verification → set up welcome and alert email templates
- [ ] **14.** Set up Sentry project → add `SENTRY_DSN` to env → wrap app with Sentry

---

## Notes for Claude Code

- Always use **TypeScript** — no plain `.js` files in `app/` or `lib/`
- Use **Prisma** for all DB operations — never raw SQL
- Use **Supabase Storage** with signed URLs for all file access — never expose raw file URLs
- All API routes must verify auth with Clerk `auth()` and check role before processing
- Claude API calls go through `lib/claude.ts` — never instantiate the client inline
- Matching engine logic lives exclusively in `lib/matching.ts` — keep it pure (no side effects)
- Document expiry cron jobs run via Vercel Cron — endpoints in `app/api/cron/`
- Social platform webhooks (Meta) → `app/api/webhooks/meta/route.ts`
- All user-facing strings must use i18n keys — never hardcode text in components
- Mobile-first breakpoints for candidate views: design for 375px first, then scale up

---

*MG Work — Technical Roadmap v1.0 — Confidential*