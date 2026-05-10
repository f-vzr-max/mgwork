# MG Work — API Contracts (M2–M8)

Source of truth for route shape, auth, validation, and audit-key naming. Every route handler under `app/api/**/route.ts` MUST match the row that names it.

## Conventions

- **Audit `action` key**: `{resource}.{action}` — examples: `candidate.create`, `document.approve`, `offer.publish`. Every mutation calls `logAudit(...)` with this key.
- **Request envelope**: JSON body, validated by named Zod schema (see `lib/validation/*`). Schemas use `.strict()` (reject extra fields). Multipart for uploads.
- **Response envelope**: `ApiResponse<T>` from `types/api.ts` — `{ ok: true, data }` on success, `{ ok: false, error }` on failure. Cron and webhook endpoints may return raw 200/204 (noted inline).
- **Auth**: All routes call Clerk `auth()` first. Role check follows. `public` = no auth (webhook). `signed-in` = any authenticated user. Otherwise the listed role(s) are required.
- **Rate limit**: every route is wrapped by `rateLimit(userId|ip, key, n, periodSec)` from `lib/rate-limit.ts`. Specific limits defined in route handlers; defaults: 60/min for reads, 10/min for writes, 5/min for AI.
- **PII**: zod schemas marked `*` strip PII from logs; never log raw passport numbers or full doc URLs.

## Decisions (from plan ambiguities)

- Plan §M5 mentions `/api/admin/matching-config` GET/PUT but says "weights table — needs new model". We standardize on **PUT** to upsert the single-row `MatchingConfig` (treated as a singleton; the row id is the cuid; client never sends id).
- Plan §M6 has both Meta webhook and in-app SSE chat. We expose **two** routes: `/api/webhooks/meta` (Meta only, public, signature-verified) and `/api/chat` (in-app SSE, signed-in CANDIDATE). Both write to `Conversation` via `lib/social/llm-bridge.ts`.
- Plan §M7 mentions cron for monthly check-in and monthly report. They share Vercel Cron headers but live at separate paths (`/api/cron/monthly-checkin`, `/api/cron/monthly-report`) so failure isolation is clean. Cron auth: `Authorization: Bearer ${process.env.CRON_SECRET}` (Vercel-injected) — checked in `lib/cron-auth.ts` (to be added by `lib-coder`).
- Plan §M8 admin `/api/admin/users/[id]` actions (ban / role change / impersonate) are surfaced as **separate** sub-routes (`/ban`, `/role`, `/impersonate`) so each is auditable with a precise action key.
- Document `signed-url` issuance is split from `GET /documents/[id]` so the signed URL never accidentally leaks via list responses.
- "freemium gate" lives in `lib/billing.ts` (called by `POST /api/enterprises/{id}/offers` — but for parity with the plan, the route is `/api/offers` with body `{ enterpriseId }`, server resolves owner from the session).

---

## M2 — Onboarding

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/candidates` | POST | signed-in (no Candidate row yet) | `candidateCreateSchema` | `ApiResponse<{ candidateId: Id }>` | `candidate.create` |
| `/api/candidates/[id]` | PATCH | signed-in (owner) or ADMIN | `candidateUpdateSchema` | `ApiResponse<{ candidateId: Id }>` | `candidate.update` |
| `/api/enterprises` | POST | signed-in (no Enterprise row yet) | `enterpriseCreateSchema` | `ApiResponse<{ enterpriseId: Id }>` | `enterprise.create` |
| `/api/enterprises/[id]` | PATCH | signed-in (owner) or ADMIN | `enterpriseUpdateSchema` | `ApiResponse<{ enterpriseId: Id }>` | `enterprise.update` |

## M3 — Documents + expiry

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/documents` | POST | CANDIDATE \| ENTERPRISE | `documentUploadSchema` (multipart meta) | `ApiResponse<{ documentId: Id }>` | `document.upload` |
| `/api/documents/[id]` | GET | owner \| STAFF_DOCUMENTS \| ADMIN \| SUPER_ADMIN | none (path) | `ApiResponse<DocumentDto>` | `document.read` |
| `/api/documents/[id]` | PATCH | STAFF_DOCUMENTS \| ADMIN | `documentPatchSchema` | `ApiResponse<DocumentDto>` | `document.update` |
| `/api/documents/[id]` | DELETE | owner \| ADMIN | none | `ApiResponse<{ deleted: true }>` | `document.delete` |
| `/api/documents/[id]/signed-url` | GET | owner \| STAFF_DOCUMENTS \| ADMIN \| SUPER_ADMIN | none | `ApiResponse<SignedUrlResponse>` | `document.signed_url_issued` |
| `/api/cron/expiry-alerts` | POST | cron-secret | none | `204 No Content` | `cron.expiry_alerts_run` |

## M4 — Staff documents queue + follow-up

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/staff/documents/[id]/approve` | POST | STAFF_DOCUMENTS \| ADMIN | `documentApproveSchema` | `ApiResponse<DocumentDto>` | `document.approve` |
| `/api/staff/documents/[id]/reject` | POST | STAFF_DOCUMENTS \| ADMIN | `documentRejectSchema` (reason required) | `ApiResponse<DocumentDto>` | `document.reject` |
| `/api/staff/checkpoints` | POST | STAFF_FOLLOWUP \| ADMIN | `checkpointCreateSchema` | `ApiResponse<{ checkpointId: Id }>` | `checkpoint.create` |
| `/api/staff/notes` | POST | STAFF_FOLLOWUP \| STAFF_DOCUMENTS \| ADMIN | `staffNoteCreateSchema` | `ApiResponse<{ noteId: Id }>` | `staff_note.create` |

## M5 — Matching + AI + offers

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/offers` | POST | ENTERPRISE | `offerCreateSchema` | `ApiResponse<{ offerId: Id }>` | `offer.create` |
| `/api/offers/[id]` | PATCH | ENTERPRISE (owner) \| ADMIN | `offerUpdateSchema` | `ApiResponse<{ offerId: Id }>` | `offer.update` |
| `/api/offers/[id]/publish` | POST | ENTERPRISE (owner) | none | `ApiResponse<{ status: 'ACTIVE' }>` | `offer.publish` |
| `/api/ai/match` | POST | ENTERPRISE (offer owner) \| ADMIN | `aiMatchSchema` `{ offerId }` | `ApiResponse<{ count: number }>` | `matching.recompute` |
| `/api/ai/extract-cv` | POST | CANDIDATE | `aiExtractCvSchema` (multipart) | `ApiResponse<CvExtractResult>` | `ai.extract_cv` |
| `/api/ai/lang-test` | POST | CANDIDATE | `aiLangTestSchema` | `ApiResponse<LangTestResult>` | `ai.lang_test` |
| `/api/ai/interview-sim` | POST | CANDIDATE | `aiInterviewSimSchema` | `ApiResponse<InterviewSimQuestionsResponse \| InterviewSimEvaluationResponse>` | `ai.interview_sim` |
| `/api/admin/matching-config` | GET | ADMIN \| SUPER_ADMIN | none | `ApiResponse<{ weights: MatchingWeights }>` | `matching_config.read` |
| `/api/admin/matching-config` | PUT | ADMIN \| SUPER_ADMIN | `matchingConfigUpdateSchema` | `ApiResponse<{ weights: MatchingWeights }>` | `matching_config.update` |

## M6 — Chat + Meta webhook

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/webhooks/meta` | GET | public (verify token) | none | `200 text/plain` (challenge echo) | `webhook.meta_verify` |
| `/api/webhooks/meta` | POST | public (signature-verified) | `metaWebhookEventSchema` | `200 No Content` | `webhook.meta_event` |
| `/api/chat` | POST | CANDIDATE | `chatMessageSchema` | `text/event-stream` (SSE) | `chat.message_send` |

## M7 — Interviews + deployment + cron

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/interviews` | POST | ENTERPRISE (offer owner) | `interviewCreateSchema` | `ApiResponse<{ interviewId: Id }>` | `interview.create` |
| `/api/interviews` | GET | ENTERPRISE \| CANDIDATE \| ADMIN | `paginationQuery` | `ApiResponse<Page<InterviewDto>>` | `interview.list` |
| `/api/interviews/[id]` | PATCH | ENTERPRISE (owner) \| CANDIDATE (owner) \| ADMIN | `interviewUpdateSchema` | `ApiResponse<InterviewDto>` | `interview.update` |
| `/api/applications/[id]/checklist` | PUT | CANDIDATE (owner) | `departureChecklistSchema` | `ApiResponse<{ saved: true }>` | `application.checklist_update` |
| `/api/cron/monthly-checkin` | POST | cron-secret | none | `204 No Content` | `cron.monthly_checkin_run` |
| `/api/cron/monthly-report` | POST | cron-secret | none | `204 No Content` | `cron.monthly_report_run` |

## M8 — Admin

| Path | Method | Auth role | Zod schema (input) | Output type | Audit action |
|---|---|---|---|---|---|
| `/api/admin/users` | GET | ADMIN \| SUPER_ADMIN | `adminUserListQuery` | `ApiResponse<Page<UserDto>>` | `user.list` |
| `/api/admin/users/[id]/ban` | POST | ADMIN \| SUPER_ADMIN | `userBanSchema` | `ApiResponse<{ userId: Id }>` | `user.ban` |
| `/api/admin/users/[id]/role` | PUT | SUPER_ADMIN | `userRoleSchema` | `ApiResponse<{ userId: Id; role: Role }>` | `user.role_change` |
| `/api/admin/users/[id]/erasure` | POST | SUPER_ADMIN | `erasureConfirmSchema` | `ApiResponse<{ userId: Id }>` | `user.erasure` |
| `/api/admin/invoices` | POST | ADMIN \| SUPER_ADMIN | `invoiceCreateSchema` | `ApiResponse<{ invoiceId: Id }>` | `invoice.create` |
| `/api/admin/invoices/[id]/mark-paid` | POST | ADMIN \| SUPER_ADMIN | `invoiceMarkPaidSchema` | `ApiResponse<{ invoiceId: Id; status: 'PAID' }>` | `invoice.mark_paid` |
| `/api/admin/audit` | GET | ADMIN \| SUPER_ADMIN | `auditQuerySchema` | `ApiResponse<Page<AuditLogDto>>` | `audit.read` |
| `/api/admin/feature-flags` | GET | ADMIN \| SUPER_ADMIN | none | `ApiResponse<FeatureFlagDto[]>` | `feature_flag.list` |
| `/api/admin/feature-flags/[key]` | PUT | SUPER_ADMIN | `featureFlagUpdateSchema` | `ApiResponse<FeatureFlagDto>` | `feature_flag.update` |
| `/api/admin/translations` | PUT | ADMIN \| SUPER_ADMIN | `translationUpsertSchema` | `ApiResponse<{ id: Id }>` | `translation.upsert` |
| `/api/me/data-export` | GET | signed-in | none | `ApiResponse<UserDataExport>` | `user.data_export` |

## Validation schema locations

All schemas live under `lib/validation/` — one file per resource: `candidate.ts`, `enterprise.ts`, `document.ts`, `job-offer.ts`, `application.ts`, `interview.ts`, `invoice.ts`, `ai.ts`, `admin.ts`, `chat.ts`, `webhook-meta.ts`. Each file exports the schemas named in the tables above. All schemas use `z.object({...}).strict()`.

## DTOs

`DocumentDto`, `InterviewDto`, `UserDto`, `AuditLogDto`, `FeatureFlagDto`, `UserDataExport` are projection types defined alongside their resource Zod schemas in `lib/validation/*.ts` (use `z.infer<>` where possible, otherwise hand-typed in `types/api.ts`).
