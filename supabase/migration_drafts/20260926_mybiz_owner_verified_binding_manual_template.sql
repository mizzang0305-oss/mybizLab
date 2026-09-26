-- MANUAL TEMPLATE ONLY. Never include this file in automatic migrations.
-- A designated operator must verify the two exact UUIDs with the Owner and
-- explicitly replace NULL below. This file ends with ROLLBACK by default.
begin;

do $binding$
declare
  v_auth_user_id uuid := null;
  v_public_profile_id uuid := null;
begin
  if v_auth_user_id is null or v_public_profile_id is null
    or v_auth_user_id = v_public_profile_id then
    raise exception 'EXACT_DISTINCT_OWNER_APPROVED_IDS_REQUIRED';
  end if;
  if not exists (
    select 1 from auth.users u
    join core.profiles cp on cp.id = u.id and cp.is_active
    where u.id = v_auth_user_id
  ) then
    raise exception 'ACTIVE_AUTH_IDENTITY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles pp
    join public.store_members sm on sm.profile_id = pp.id and sm.role = 'owner'
    where pp.id = v_public_profile_id
  ) then
    raise exception 'OWNER_BUSINESS_PROFILE_AND_MEMBERSHIP_REQUIRED';
  end if;
  if exists (
    select 1 from private.profile_auth_bindings b
    where (b.auth_profile_id = v_auth_user_id or b.public_profile_id = v_public_profile_id)
      and b.status = 'ACTIVE' and b.revoked_at is null
  ) then
    raise exception 'ACTIVE_BINDING_CONFLICT';
  end if;
  if exists (
    select 1 from private.profile_auth_bindings b
    where b.auth_profile_id = v_auth_user_id or b.public_profile_id = v_public_profile_id
  ) then
    raise exception 'HISTORICAL_BINDING_REQUIRES_SEPARATE_REVIEW';
  end if;

  insert into private.profile_auth_bindings
    (public_profile_id, auth_profile_id, binding_source, status)
  values (v_public_profile_id, v_auth_user_id, 'OWNER_VERIFIED', 'ACTIVE');
end;
$binding$;

-- Replace with COMMIT only in a later, explicitly approved Production operation.
rollback;
