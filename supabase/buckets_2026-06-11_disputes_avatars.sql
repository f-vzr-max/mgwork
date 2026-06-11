-- Storage buckets (2026-06-11): dispute-attachments + avatars.
--
-- MANUAL STEP — run in the Supabase dashboard SQL editor. Until this runs,
-- the app paths that write to these buckets fail with 500
-- (EXTERNAL_DEPENDENCY_FAILED "Bucket not found"):
--   * POST /api/admin/disputes/[id]/attachments  → dispute-attachments
--   * POST /api/candidates/me/avatar             → avatars
--
-- Idempotent: bucket inserts are ON CONFLICT DO NOTHING, helper functions are
-- CREATE OR REPLACE, policies are DROP IF EXISTS + CREATE. Safe to re-run.
--
-- Both buckets are PRIVATE (public = false); the app serves files only via
-- short-lived signed URLs issued by the service-role client. Bucket-level
-- size/MIME limits mirror the app-side validation as defense-in-depth.
-- Policies match the per-bucket convention in supabase/policies.sql
-- (storage_{bucket}_owner / _staff_read / _admin_all); the helper functions
-- are re-declared here so this script stands alone even on a database where
-- policies.sql has not been applied.

-- 1) Buckets ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dispute-attachments',
  'dispute-attachments',
  false,
  10485760, -- 10 MB, mirrors MAX_UPLOAD_BYTES in lib/documents.ts
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880, -- 5 MB, mirrors MAX_AVATAR_BYTES in app/api/candidates/me/avatar
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2) Helper functions (idempotent, same bodies as supabase/policies.sql) ------

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

-- 3) Storage policies (same loop shape as supabase/policies.sql) --------------

-- NOTE: %I must wrap the WHOLE policy name. format('storage_%I_owner', b)
-- quote_idents the hyphenated bucket alone — storage_"dispute-attachments"_owner —
-- two adjacent identifier tokens, which PostgreSQL rejects as a syntax error.
do $$
declare
  buckets text[] := array['dispute-attachments', 'avatars'];
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
