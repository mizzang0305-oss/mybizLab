-- DRAFT ONLY: Service OS Auth Identity Foundation R1.
-- AUTH_IDENTITY_FOUNDATION_STATUS=OWNER_APPLY_GATE_REQUIRED
-- This file creates an explicit Auth/Core -> public business-profile bridge.
-- It does not activate Service OS writes or modify the global membership function.

begin;

do $$
declare
  v_core_id_attnum smallint;
  v_auth_id_attnum smallint;
begin
  if to_regclass('core.profiles') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.store_members') is null then
    raise exception 'AUTH_IDENTITY_REQUIRED_RELATION_MISSING' using errcode = '42P01';
  end if;

  select attnum into v_core_id_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'core.profiles'::regclass and attname = 'id'
    and attnum > 0 and not attisdropped;

  select attnum into v_auth_id_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'auth.users'::regclass and attname = 'id'
    and attnum > 0 and not attisdropped;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.conrelid = 'core.profiles'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.conkey = array[v_core_id_attnum]::smallint[]
      and c.confkey = array[v_auth_id_attnum]::smallint[]
  ) then
    raise exception 'CORE_PROFILE_AUTH_FK_REQUIRED' using errcode = '42830';
  end if;

  if to_regprocedure('core.handle_auth_user_created()') is null
     or not exists (
       select 1
       from pg_catalog.pg_trigger t
       where t.tgrelid = 'auth.users'::regclass
         and not t.tgisinternal
         and t.tgenabled <> 'D'
         and t.tgfoid = 'core.handle_auth_user_created()'::regprocedure
     ) then
    raise exception 'CORE_AUTH_CREATE_TRIGGER_REQUIRED' using errcode = '42883';
  end if;

  if to_regprocedure('public.is_store_member(uuid)') is null then
    raise exception 'GLOBAL_MEMBERSHIP_FUNCTION_REQUIRED' using errcode = '42883';
  end if;

  if pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'AUTHENTICATED_PRIVATE_SCHEMA_USAGE_COLLISION' using errcode = '42501';
  end if;

  if to_regclass('private.profile_auth_bindings') is not null
     or to_regprocedure('private.current_service_os_business_profile_id()') is not null
     or to_regprocedure('private.is_service_os_store_member(uuid)') is not null then
    raise exception 'AUTH_IDENTITY_OBJECT_COLLISION_REQUIRES_REVIEW' using errcode = '42710';
  end if;
end;
$$;

create table private.profile_auth_bindings (
  id uuid primary key default gen_random_uuid(),
  public_profile_id uuid not null references public.profiles(id) on delete restrict,
  auth_profile_id uuid not null references core.profiles(id) on delete restrict,
  binding_source text not null check (
    binding_source in ('EXACT_ID', 'OWNER_VERIFIED', 'MIGRATION_VERIFIED', 'ADMIN_VERIFIED')
  ),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  created_at timestamptz not null default timezone('utc', now()),
  verified_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint profile_auth_bindings_exact_id_check check (
    binding_source <> 'EXACT_ID' or public_profile_id = auth_profile_id
  ),
  constraint profile_auth_bindings_status_time_check check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
  )
);

create unique index profile_auth_bindings_active_public_uidx
  on private.profile_auth_bindings(public_profile_id)
  where status = 'ACTIVE' and revoked_at is null;

create unique index profile_auth_bindings_active_auth_uidx
  on private.profile_auth_bindings(auth_profile_id)
  where status = 'ACTIVE' and revoked_at is null;

create index profile_auth_bindings_auth_lookup_idx
  on private.profile_auth_bindings(auth_profile_id, status);

alter table private.profile_auth_bindings enable row level security;
alter table private.profile_auth_bindings force row level security;
revoke all privileges on table private.profile_auth_bindings from public, anon, authenticated;

insert into private.profile_auth_bindings (
  public_profile_id,
  auth_profile_id,
  binding_source,
  status,
  verified_at,
  metadata
)
select
  p.id,
  cp.id,
  'EXACT_ID',
  'ACTIVE',
  timezone('utc', now()),
  '{"backfill":"exact-id-triple"}'::jsonb
from public.profiles p
join core.profiles cp on cp.id = p.id
join auth.users au on au.id = cp.id
where not exists (
  select 1
  from private.profile_auth_bindings b
  where b.public_profile_id = p.id or b.auth_profile_id = cp.id
);

create function private.current_service_os_business_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with current_identity as (
    select auth.uid() as id
  ),
  explicit_binding as (
    select b.public_profile_id
    from private.profile_auth_bindings b
    join current_identity ci on ci.id = b.auth_profile_id
    join core.profiles cp on cp.id = b.auth_profile_id and cp.is_active
    where b.status = 'ACTIVE'
      and b.revoked_at is null
    limit 1
  ),
  exact_id_fallback as (
    select ci.id as public_profile_id
    from current_identity ci
    join auth.users au on au.id = ci.id
    join core.profiles cp on cp.id = ci.id and cp.is_active
    join public.profiles pp on pp.id = ci.id
    where not exists (
      select 1
      from private.profile_auth_bindings b
      where b.auth_profile_id = ci.id or b.public_profile_id = ci.id
    )
  )
  select coalesce(
    (select eb.public_profile_id from explicit_binding eb),
    (select ef.public_profile_id from exact_id_fallback ef)
  );
$$;

create function private.is_service_os_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.store_members sm
      where sm.store_id = target_store_id
        and sm.profile_id = private.current_service_os_business_profile_id()
    );
$$;

revoke all on function private.current_service_os_business_profile_id() from public, anon;
revoke all on function private.is_service_os_store_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_service_os_business_profile_id() to authenticated;
grant execute on function private.is_service_os_store_member(uuid) to authenticated;

commit;
