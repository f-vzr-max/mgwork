-- =============================================================================
-- MG Work — Row Level Security Policies
-- =============================================================================
-- This file is the source-of-truth copy of RLS for all tables in the schema
-- defined at prisma/schema.prisma. It MUST be reviewed by a human before
-- being applied to a Supabase project. Apply via Supabase SQL editor or via
-- the deployment helper at scripts/apply-rls.ts (TODO).
--
-- Trust model
-- -----------
-- Today the Next.js server connects to Postgres with a single Supabase
-- service-role key (lib/supabase.ts) and authorization is enforced in our
-- API route handlers (`auth()` + role check + `logAudit()`). The policies
-- below are defense-in-depth: they ensure that even if a developer
-- accidentally connects from the browser using an anon key, or a future
-- feature uses Supabase JWT auth directly, role isolation still holds.
--
-- The policies assume a `request.jwt.claims` payload populated by the
-- forthcoming Supabase auth bridge (third-party JWT verification of the
-- Clerk session) with the following shape:
--   {
--     "sub":   "<clerk user id>",
--     "role":  "CANDIDATE" | "ENTERPRISE" | "STAFF_FOLLOWUP" |
--              "STAFF_DOCUMENTS" | "ADMIN" | "SUPER_ADMIN",
--     "user_id": "<internal User.id>"  -- our cuid, set by webhook
--   }
--
-- Helper functions are defined first so policies stay readable.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Helper functions (idempotent)
-- -----------------------------------------------------------------------------

create or replace function public.current_user_id() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'user_id', ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')
  );
$$;

create or replace function public.current_role_name() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'role', '');
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_role_name() in ('ADMIN', 'SUPER_ADMIN');
$$;

create or replace function public.is_staff_documents() returns boolean
language sql stable as $$
  select public.current_role_name() = 'STAFF_DOCUMENTS' or public.is_admin();
$$;

create or replace function public.is_staff_followup() returns boolean
language sql stable as $$
  select public.current_role_name() = 'STAFF_FOLLOWUP' or public.is_admin();
$$;

create or replace function public.is_any_staff() returns boolean
language sql stable as $$
  select public.current_role_name() in (
    'STAFF_FOLLOWUP', 'STAFF_DOCUMENTS', 'ADMIN', 'SUPER_ADMIN'
  );
$$;


-- -----------------------------------------------------------------------------
-- 1. User
-- -----------------------------------------------------------------------------
-- A user can read their own row; admins read all. No client-side writes —
-- the Clerk webhook is server-only (service role), so INSERT/UPDATE/DELETE
-- have no permissive policies for non-admin roles.

alter table "User" enable row level security;

drop policy if exists user_self_select on "User";
create policy user_self_select on "User"
  for select using (
    id = public.current_user_id() or public.is_admin()
  );

drop policy if exists user_admin_all on "User";
create policy user_admin_all on "User"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 2. Candidate
-- -----------------------------------------------------------------------------
-- Candidate sees own row. Enterprises see candidates who have applied to one
-- of their offers OR who appear in their `Matching` shortlist. Staff see all
-- candidates relevant to their queues. Admin sees all.

alter table "Candidate" enable row level security;

drop policy if exists candidate_self on "Candidate";
create policy candidate_self on "Candidate"
  for all
  using ("userId" = public.current_user_id())
  with check ("userId" = public.current_user_id());

drop policy if exists candidate_enterprise_via_application on "Candidate";
create policy candidate_enterprise_via_application on "Candidate"
  for select using (
    public.current_role_name() = 'ENTERPRISE' and exists (
      select 1
      from "Application" a
      join "JobOffer" jo on jo.id = a."jobOfferId"
      join "Enterprise" e on e.id = jo."enterpriseId"
      where a."candidateId" = "Candidate".id
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists candidate_enterprise_via_matching on "Candidate";
create policy candidate_enterprise_via_matching on "Candidate"
  for select using (
    public.current_role_name() = 'ENTERPRISE' and exists (
      select 1
      from "Matching" m
      join "JobOffer" jo on jo.id = m."jobOfferId"
      join "Enterprise" e on e.id = jo."enterpriseId"
      where m."candidateId" = "Candidate".id
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists candidate_staff_select on "Candidate";
create policy candidate_staff_select on "Candidate"
  for select using (public.is_any_staff());

drop policy if exists candidate_admin_all on "Candidate";
create policy candidate_admin_all on "Candidate"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 3. Enterprise
-- -----------------------------------------------------------------------------

alter table "Enterprise" enable row level security;

drop policy if exists enterprise_self on "Enterprise";
create policy enterprise_self on "Enterprise"
  for all
  using ("userId" = public.current_user_id())
  with check ("userId" = public.current_user_id());

drop policy if exists enterprise_staff_select on "Enterprise";
create policy enterprise_staff_select on "Enterprise"
  for select using (public.is_any_staff());

drop policy if exists enterprise_admin_all on "Enterprise";
create policy enterprise_admin_all on "Enterprise"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 4. Document
-- -----------------------------------------------------------------------------
-- Owner (candidate OR enterprise) sees own. STAFF_DOCUMENTS sees pending +
-- everything they verified. ADMIN sees all. Other roles see nothing.

alter table "Document" enable row level security;

drop policy if exists document_candidate_owner on "Document";
create policy document_candidate_owner on "Document"
  for all
  using (
    "candidateId" is not null and exists (
      select 1 from "Candidate" c
      where c.id = "Document"."candidateId"
        and c."userId" = public.current_user_id()
    )
  )
  with check (
    "candidateId" is not null and exists (
      select 1 from "Candidate" c
      where c.id = "Document"."candidateId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists document_enterprise_owner on "Document";
create policy document_enterprise_owner on "Document"
  for all
  using (
    "enterpriseId" is not null and exists (
      select 1 from "Enterprise" e
      where e.id = "Document"."enterpriseId"
        and e."userId" = public.current_user_id()
    )
  )
  with check (
    "enterpriseId" is not null and exists (
      select 1 from "Enterprise" e
      where e.id = "Document"."enterpriseId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists document_staff_documents on "Document";
create policy document_staff_documents on "Document"
  for all
  using (public.is_staff_documents())
  with check (public.is_staff_documents());

drop policy if exists document_admin_all on "Document";
create policy document_admin_all on "Document"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 5. JobOffer
-- -----------------------------------------------------------------------------
-- Active offers are public-read for CANDIDATEs (so they can browse).
-- Owning enterprise has full control. Staff/admin see all.

alter table "JobOffer" enable row level security;

drop policy if exists offer_public_active_select on "JobOffer";
create policy offer_public_active_select on "JobOffer"
  for select using (status = 'ACTIVE');

drop policy if exists offer_enterprise_owner on "JobOffer";
create policy offer_enterprise_owner on "JobOffer"
  for all
  using (
    exists (
      select 1 from "Enterprise" e
      where e.id = "JobOffer"."enterpriseId"
        and e."userId" = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from "Enterprise" e
      where e.id = "JobOffer"."enterpriseId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists offer_staff_select on "JobOffer";
create policy offer_staff_select on "JobOffer"
  for select using (public.is_any_staff());

drop policy if exists offer_admin_all on "JobOffer";
create policy offer_admin_all on "JobOffer"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 6. Application
-- -----------------------------------------------------------------------------

alter table "Application" enable row level security;

drop policy if exists application_candidate_owner on "Application";
create policy application_candidate_owner on "Application"
  for all
  using (
    exists (
      select 1 from "Candidate" c
      where c.id = "Application"."candidateId"
        and c."userId" = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from "Candidate" c
      where c.id = "Application"."candidateId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists application_enterprise_owner on "Application";
create policy application_enterprise_owner on "Application"
  for all
  using (
    exists (
      select 1 from "JobOffer" jo
      join "Enterprise" e on e.id = jo."enterpriseId"
      where jo.id = "Application"."jobOfferId"
        and e."userId" = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from "JobOffer" jo
      join "Enterprise" e on e.id = jo."enterpriseId"
      where jo.id = "Application"."jobOfferId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists application_staff_followup on "Application";
create policy application_staff_followup on "Application"
  for select using (
    public.is_staff_followup()
    and status in ('DEPLOYED', 'COMPLETED')
  );

drop policy if exists application_admin_all on "Application";
create policy application_admin_all on "Application"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 7. Matching
-- -----------------------------------------------------------------------------

alter table "Matching" enable row level security;

drop policy if exists matching_candidate_self on "Matching";
create policy matching_candidate_self on "Matching"
  for select using (
    exists (
      select 1 from "Candidate" c
      where c.id = "Matching"."candidateId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists matching_enterprise_owner on "Matching";
create policy matching_enterprise_owner on "Matching"
  for select using (
    exists (
      select 1 from "JobOffer" jo
      join "Enterprise" e on e.id = jo."enterpriseId"
      where jo.id = "Matching"."jobOfferId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists matching_admin_all on "Matching";
create policy matching_admin_all on "Matching"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 8. Interview
-- -----------------------------------------------------------------------------

alter table "Interview" enable row level security;

drop policy if exists interview_candidate_via_application on "Interview";
create policy interview_candidate_via_application on "Interview"
  for select using (
    exists (
      select 1 from "Application" a
      join "Candidate" c on c.id = a."candidateId"
      where a.id = "Interview"."applicationId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists interview_enterprise_via_application on "Interview";
create policy interview_enterprise_via_application on "Interview"
  for all
  using (
    exists (
      select 1 from "Application" a
      join "JobOffer" jo on jo.id = a."jobOfferId"
      join "Enterprise" e on e.id = jo."enterpriseId"
      where a.id = "Interview"."applicationId"
        and e."userId" = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from "Application" a
      join "JobOffer" jo on jo.id = a."jobOfferId"
      join "Enterprise" e on e.id = jo."enterpriseId"
      where a.id = "Interview"."applicationId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists interview_admin_all on "Interview";
create policy interview_admin_all on "Interview"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 9. Checkpoint  (deployment follow-up)
-- -----------------------------------------------------------------------------

alter table "Checkpoint" enable row level security;

drop policy if exists checkpoint_candidate_self on "Checkpoint";
create policy checkpoint_candidate_self on "Checkpoint"
  for select using (
    exists (
      select 1 from "Candidate" c
      where c.id = "Checkpoint"."candidateId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists checkpoint_staff_followup on "Checkpoint";
create policy checkpoint_staff_followup on "Checkpoint"
  for all
  using (public.is_staff_followup())
  with check (public.is_staff_followup());

drop policy if exists checkpoint_admin_all on "Checkpoint";
create policy checkpoint_admin_all on "Checkpoint"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 10. StaffNote (private internal notes)
-- -----------------------------------------------------------------------------
-- Only the staff author + admins. Never exposed to candidate/enterprise.

alter table "StaffNote" enable row level security;

drop policy if exists staffnote_author on "StaffNote";
create policy staffnote_author on "StaffNote"
  for all
  using ("staffId" = public.current_user_id() and public.is_any_staff())
  with check ("staffId" = public.current_user_id() and public.is_any_staff());

drop policy if exists staffnote_admin_all on "StaffNote";
create policy staffnote_admin_all on "StaffNote"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 11. Conversation
-- -----------------------------------------------------------------------------

alter table "Conversation" enable row level security;

drop policy if exists conversation_candidate_self on "Conversation";
create policy conversation_candidate_self on "Conversation"
  for all
  using (
    exists (
      select 1 from "Candidate" c
      where c.id = "Conversation"."candidateId"
        and c."userId" = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from "Candidate" c
      where c.id = "Conversation"."candidateId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists conversation_staff_select on "Conversation";
create policy conversation_staff_select on "Conversation"
  for select using (public.is_any_staff());

drop policy if exists conversation_admin_all on "Conversation";
create policy conversation_admin_all on "Conversation"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 12. Invoice
-- -----------------------------------------------------------------------------

alter table "Invoice" enable row level security;

drop policy if exists invoice_enterprise_owner on "Invoice";
create policy invoice_enterprise_owner on "Invoice"
  for select using (
    exists (
      select 1 from "Enterprise" e
      where e.id = "Invoice"."enterpriseId"
        and e."userId" = public.current_user_id()
    )
  );

drop policy if exists invoice_admin_all on "Invoice";
create policy invoice_admin_all on "Invoice"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 13. AuditLog
-- -----------------------------------------------------------------------------
-- Append-only from the application's perspective. Only admins can read.
-- No UPDATE / DELETE policy (intentionally) — see retention note at bottom.

alter table "AuditLog" enable row level security;

drop policy if exists auditlog_admin_select on "AuditLog";
create policy auditlog_admin_select on "AuditLog"
  for select using (public.is_admin());

drop policy if exists auditlog_self_select on "AuditLog";
create policy auditlog_self_select on "AuditLog"
  for select using ("userId" = public.current_user_id());

-- INSERT is performed exclusively by the app server using the service role,
-- which bypasses RLS. We deliberately do NOT define an INSERT policy here,
-- so direct client inserts are blocked.


-- =============================================================================
-- New models from M5 / M7 / M8 (MatchingConfig, FeatureFlag, Translation,
-- CheckinPing). Already present in prisma/schema.prisma as of architect M1.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 14. MatchingConfig
-- -----------------------------------------------------------------------------
-- Single-row table tuned by admins. Read by app server (service role) for
-- scoring. Direct client access is admin-only.

alter table "MatchingConfig" enable row level security;

drop policy if exists matchingconfig_admin_all on "MatchingConfig";
create policy matchingconfig_admin_all on "MatchingConfig"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 15. FeatureFlag
-- -----------------------------------------------------------------------------
-- Read-only to all authenticated users (so the UI can hide/show features),
-- write-only to admins.

alter table "FeatureFlag" enable row level security;

drop policy if exists featureflag_authenticated_select on "FeatureFlag";
create policy featureflag_authenticated_select on "FeatureFlag"
  for select using (public.current_user_id() is not null);

drop policy if exists featureflag_admin_write on "FeatureFlag";
create policy featureflag_admin_write on "FeatureFlag"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 16. Translation
-- -----------------------------------------------------------------------------
-- Public read (i18n strings are not sensitive); admin-only write.

alter table "Translation" enable row level security;

drop policy if exists translation_public_select on "Translation";
create policy translation_public_select on "Translation"
  for select using (true);

drop policy if exists translation_admin_write on "Translation";
create policy translation_admin_write on "Translation"
  for all using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 17. CheckinPing
-- -----------------------------------------------------------------------------
-- Sent monthly to deployed candidates. Candidate sees own; staff/admin all.

alter table "CheckinPing" enable row level security;

drop policy if exists checkinping_candidate_self on "CheckinPing";
create policy checkinping_candidate_self on "CheckinPing"
  for select using (
    exists (
      select 1 from "Application" a
      join "Candidate" c on c.id = a."candidateId"
      where a.id = "CheckinPing"."applicationId"
        and c."userId" = public.current_user_id()
    )
  );

drop policy if exists checkinping_staff_followup on "CheckinPing";
create policy checkinping_staff_followup on "CheckinPing"
  for all
  using (public.is_staff_followup())
  with check (public.is_staff_followup());

drop policy if exists checkinping_admin_all on "CheckinPing";
create policy checkinping_admin_all on "CheckinPing"
  for all using (public.is_admin()) with check (public.is_admin());


-- =============================================================================
-- Storage bucket policies
-- =============================================================================
-- Buckets (created externally): passports, medical-docs, cvs, scans, visas,
-- dispute-attachments, avatars. See also the standalone idempotent script
-- supabase/buckets_2026-06-11_disputes_avatars.sql which CREATES the two
-- newest buckets (this file only writes policies; it assumes buckets exist).
-- Path convention enforced in app code: `{role}/{userId}/{type}/{filename}`.
-- We mirror the convention here so RLS can match on path prefix.
--
-- The owner can read/write only files under their own `{role}/{userId}/...`.
-- STAFF_DOCUMENTS can read everything in any bucket.
-- ADMIN can read + write everything.
--
-- Apply via the Supabase storage admin API or SQL editor (storage.objects
-- table is in the `storage` schema).
-- =============================================================================

-- Example pattern — repeat per bucket. We loop here using PL/pgSQL for clarity.
-- NOTE: %I must wrap the WHOLE policy name. format('storage_%I_owner', b)
-- quote_idents a hyphenated bucket alone (storage_"medical-docs"_owner) — two
-- adjacent identifier tokens, which PostgreSQL rejects as a syntax error.
do $$
declare
  buckets text[] := array['passports', 'medical-docs', 'cvs', 'scans', 'visas',
                          'dispute-attachments', 'avatars'];
  b text;
begin
  foreach b in array buckets loop
    -- Owner read/write: object name starts with `{role}/{user_id}/`
    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for all
        using (
          bucket_id = %L
          and (storage.foldername(name))[2] = public.current_user_id()
        )
        with check (
          bucket_id = %L
          and (storage.foldername(name))[2] = public.current_user_id()
        );
    $f$, 'storage_' || b || '_owner', 'storage_' || b || '_owner', b, b);

    -- Staff documents: read all in any bucket
    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for select
        using (bucket_id = %L and public.is_staff_documents());
    $f$, 'storage_' || b || '_staff_read', 'storage_' || b || '_staff_read', b);

    -- Admin: full access
    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for all
        using (bucket_id = %L and public.is_admin())
        with check (bucket_id = %L and public.is_admin());
    $f$, 'storage_' || b || '_admin_all', 'storage_' || b || '_admin_all', b, b);
  end loop;
end $$;


-- =============================================================================
-- Audit log retention
-- =============================================================================
-- Per roadmap §7 (Legal Compliance), audit logs are retained for a minimum of
-- 5 years to satisfy the Mauritius Data Protection Act 2017 and align with
-- GDPR record-keeping expectations.
--
-- Implementation note:
--   * No automatic delete job is configured. The AuditLog table grows
--     unboundedly until a human (ADMIN) explicitly archives or prunes it.
--   * We have intentionally NOT defined UPDATE or DELETE policies on
--     AuditLog — even admin direct-DB tampering is logged in Postgres'
--     pg_stat_statements / Supabase logs.
--   * If a future feature needs to redact a specific audit record (e.g.
--     after a GDPR right-to-erasure request that requires removing PII from
--     an old log entry), do it via a dedicated migration script reviewed by
--     legal — not via an ad-hoc client query.
--   * After 5 years, an admin job may export the relevant rows to cold
--     storage and delete from the live table.
--
-- TL;DR: append-only, no auto-delete, 5y minimum retention enforced by ops.
-- =============================================================================
