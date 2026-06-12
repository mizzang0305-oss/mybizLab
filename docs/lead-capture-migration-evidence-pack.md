# Lead capture migration evidence pack

Date: 2026-06-12

This pack is for owner review before any production migration apply, RLS policy apply, or live lead write enablement. It is an evidence checklist and SQL query set only. Do not run any write, migration, deploy, payment, webhook, auth/env, customer notification, or external API mutation from this document.

## Scope

- Migration draft: `supabase/migrations/20260609_lead_capture_requests.sql`
- Target table: `public.lead_capture_requests`
- Related access truth: `public.store_members`, `public.store_subscriptions`, `public.profiles`, `public.stores`
- Repository boundary: `src/server/mybiz/repositories/supabaseLeadCaptureRepository.ts`
- Launch gates: `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, `liveLeadWriteEnabled`

## Safety rules

- Run only count, schema, index, RLS, policy, role, and migration-history evidence queries.
- Do not select row samples.
- Do not print env values, secrets, tokens, cookies, sessions, payment payloads, raw browser storage, or customer PII.
- Do not apply the migration from this pack.
- Do not enable `leadCapturePersistenceEnabled` or `liveLeadWriteEnabled` from this pack.

## Production evidence queries

Paste these into the Supabase SQL Editor only after owner approval to collect evidence. These are read-only evidence queries.

### 1. Table existence

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'lead_capture_requests';
```

Expected before first apply: zero rows. Current production evidence shows the table already exists, so migration apply is blocked until the existing table is classified with `docs/lead-capture-existing-table-decision.md`.

### 2. Column collision check

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'lead_capture_requests'
order by ordinal_position;
```

Expected before first apply: zero rows. If rows are returned, compare every column against the migration draft and classify as `compatible_existing_table`, `idempotent_alter_required`, or `blocked_existing_data_or_policy_risk`.

### 3. Index collision check

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'lead_capture_requests'
order by indexname;
```

Expected before first apply: zero rows. Existing indexes require manual comparison before apply.

### 4. RLS enabled status

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'lead_capture_requests';
```

Expected before first apply: zero rows. If the table already exists, `rls_enabled = true` is required before live write enablement, and `false` is a blocker if broad grants exist.

### 5. Policy list

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'lead_capture_requests'
order by policyname;
```

Expected after apply:

- platform admin select, insert, update policies exist.
- store member select, update policies exist.
- no delete policy exists.
- no anon policy exists.

### 6. Public and anon grants

```sql
select
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'lead_capture_requests'
  and grantee in ('anon', 'authenticated', 'public')
order by grantee, privilege_type;
```

Expected: no broad `anon` or `public` table grants. Any authenticated grants must still be constrained by RLS.

### 7. Existing migration history

```sql
select
  'migration_history_guarded' as evidence_key,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_table_exists,
  case
    when to_regclass('supabase_migrations.schema_migrations') is null then null
    else (
      xpath(
        '/row/matching_migration_count/text()',
        query_to_xml(
          'select count(*) as matching_migration_count from supabase_migrations.schema_migrations where name ilike ''%lead_capture%'' or version = ''20260609''',
          false,
          true,
          ''
        )
      )
    )[1]::text::bigint
  end as matching_migration_count;
```

Expected before apply: `matching_migration_count` is `0` if the migration history table exists. If the migration history table is unavailable in the SQL Editor, record that as evidence gap and use owner-approved Supabase project history evidence before apply.

### 8. Lead capture row count

```sql
select count(*) as lead_capture_requests_count
from public.lead_capture_requests;
```

Expected before apply: query should fail if the table does not exist. Expected after apply and before live write enablement: `0`.

### 9. Store membership table existence

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'store_members';
```

Expected: one row. Store membership is the dashboard access truth.

### 10. Store subscriptions table existence

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'store_subscriptions';
```

Expected: one row. Store subscriptions are the paid entitlement truth.

### 11. Profiles and stores relationship evidence

```sql
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('lead_capture_requests', 'store_members', 'stores', 'profiles')
order by tc.table_name, kcu.column_name;
```

Expected after the 2026-06-10 drift fix: `lead_capture_requests.store_id` references `stores.store_id`, and `lead_capture_requests.owner_profile_id` references `profiles.id` after apply. Current evidence shows those FK constraints already exist, but the full live column/index/RLS/policy/grant/row_count evidence is still required.

### 12. FK target column drift evidence

Run this before applying the migration if a foreign-key error mentions a missing referenced column. This query returns schema only and does not inspect row data.

```sql
select
  'fk_target_columns' as evidence_key,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'stores', 'store_members', 'platform_admin_members')
order by table_name, ordinal_position;
```

Expected production evidence before apply:

- `stores.store_id` exists and is compatible with `uuid`.
- `profiles.id` exists and is compatible with `uuid`.
- `store_members.store_id` points at `stores.store_id`.
- `store_members.profile_id` points at `profiles.id`.
- `platform_admin_members.profile_id` is compatible with `auth.uid()` if policies compare `pam.profile_id = auth.uid()`.

### 13. PK/FK/unique constraint drift evidence

```sql
select
  'key_constraints' as evidence_key,
  tc.table_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.table_name in ('profiles', 'stores', 'store_members', 'platform_admin_members')
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type, kcu.column_name;
```

Expected: the referenced columns used by the draft exist as primary or unique keys, or the apply remains blocked until the FK strategy is revised.

## Draft collision assessment

- Table creation uses `create table if not exists`, and the draft now includes additive `alter table ... add column if not exists` statements for an existing-table path.
- An existing incompatible table is still a blocker.
- Index names are explicit and must not already exist on a different definition.
- Production evidence showed `store_members.store_id` references `stores.store_id`, so the lead-capture draft must not reference `stores.id`.
- Evidence confirms `profiles.id` is a primary key and `platform_admin_members.profile_id` references `profiles.id`, but the `pam.profile_id = auth.uid()` policy predicate remains blocked until evidence proves `profiles.id` is the same identifier as `auth.uid()` or an approved auth-user mapping column is used.
- The migration expects `public.set_updated_at()` to already exist.
- The RLS draft depends on `public.platform_admin_members` and `public.is_store_member(store_id)`.
- Public visitor insert is intentionally absent.
- Anonymous select, update, and delete are intentionally absent.
- Delete policy is intentionally absent; use `archived` status instead.

## Existing table classification

Use this classification before any migration apply:

- `compatible_existing_table`: live table, columns, FK targets, indexes, RLS, policies, grants, and row_count are compatible with the draft and no public/anon broad access exists.
- `idempotent_alter_required`: live table exists but only additive columns/indexes/constraints/policies are missing, and row_count/retention evidence shows the additive path is safe.
- `blocked_existing_data_or_policy_risk`: live table has unknown columns, incompatible FK targets, public/anon broad grants, delete policies, RLS disabled with broad access, row_count risk, migration-history drift, or unresolved platform-admin auth mapping.

Current classification from available evidence: `idempotent_alter_required` is likely, but apply remains `BLOCKED` until full live `lead_capture_requests` evidence and auth mapping evidence are collected.

## Repository gate evidence

Before live insert can be reached, all three gates must be approved:

1. `broadDbWriteEnabled`
2. `leadCapturePersistenceEnabled`
3. `liveLeadWriteEnabled`

Default production posture remains:

```json
{
  "broadDbWriteEnabled": false,
  "leadCapturePersistenceEnabled": false,
  "liveLeadWriteEnabled": false,
  "live_lead_write": false
}
```

## Evidence handoff format

Record only sanitized evidence:

- query name
- PASS/BLOCKED result
- row counts only
- policy names and commands
- schema/index names
- blockers and next approval needed

Do not record raw lead rows, contact details, browser storage, tokens, cookies, sessions, payment payloads, or secret values.
