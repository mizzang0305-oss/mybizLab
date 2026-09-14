-- READ-ONLY / SANITIZED Production metadata inventory.
-- Run only after independently confirming the exact MyBiz project identity.
-- This file reads catalogs only: no application rows, customer data, SQL DDL,
-- migration apply, migration history repair, or remote write is performed.

select current_setting('server_version') as postgres_version;

select n.nspname as schema_name, c.relname as relation_name, c.relkind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (
  ('public', 'stores'),
  ('public', 'store_members'),
  ('public', 'profiles'),
  ('public', 'customers'),
  ('public', 'contracts'),
  ('private', 'initialize_job_evidence_revision'),
  ('supabase_migrations', 'schema_migrations')
)
or (n.nspname = 'public' and c.relname = any(array[
  'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
  'job_confirmations', 'job_confirmation_links', 'consent_records',
  'job_payment_requests', 'content_candidates', 'brand_sites',
  'brand_site_portfolio_items', 'vertical_templates'
]))
order by n.nspname, c.relname;

select table_schema, table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where (table_schema, table_name) in (
  ('public', 'stores'),
  ('public', 'store_members'),
  ('public', 'profiles'),
  ('public', 'customers'),
  ('public', 'contracts')
)
order by table_schema, table_name, ordinal_position;

select
  source_ns.nspname as source_schema,
  source.relname as source_table,
  constraint_record.conname as constraint_name,
  constraint_record.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_record.oid, true) as definition
from pg_catalog.pg_constraint constraint_record
join pg_catalog.pg_class source on source.oid = constraint_record.conrelid
join pg_catalog.pg_namespace source_ns on source_ns.oid = source.relnamespace
where source_ns.nspname = 'public'
  and source.relname = any(array['stores', 'store_members', 'profiles', 'customers', 'contracts'])
order by source.relname, constraint_record.conname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = any(array[
    'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
    'job_confirmations', 'job_confirmation_links', 'consent_records',
    'job_payment_requests', 'content_candidates', 'brand_sites',
    'brand_site_portfolio_items', 'vertical_templates'
  ])
order by tablename, policyname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = any(array[
    'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
    'job_confirmations', 'job_confirmation_links', 'consent_records',
    'job_payment_requests', 'content_candidates', 'brand_sites',
    'brand_site_portfolio_items', 'vertical_templates'
  ])
  and grantee = any(array['anon', 'authenticated', 'service_role'])
order by table_name, grantee, privilege_type;

select n.nspname as function_schema, p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname = 'is_store_member')
   or (n.nspname = 'private' and p.proname like '%service_os%')
   or (n.nspname = 'private' and p.proname = any(array[
     'initialize_job_evidence_revision',
     'create_next_job_evidence_revision',
     'consume_job_confirmation_link'
   ]))
order by n.nspname, p.proname;
