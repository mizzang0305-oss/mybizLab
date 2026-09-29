-- Future migration after CURRENT_PRODUCTION_SCHEMA_BASELINE_V1.
-- The server supplies only the UUID returned by Auth getUser(accessToken).
begin;

create function private.resolve_service_os_business_profile_id(p_auth_user_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  with explicit_binding as (
    select b.public_profile_id
    from private.profile_auth_bindings b
    join core.profiles cp on cp.id = b.auth_profile_id and cp.is_active
    where b.auth_profile_id = p_auth_user_id
      and b.status = 'ACTIVE'
      and b.revoked_at is null
    limit 1
  ),
  exact_id_fallback as (
    select p_auth_user_id as public_profile_id
    from auth.users au
    join core.profiles cp on cp.id = au.id and cp.is_active
    join public.profiles pp on pp.id = au.id
    where au.id = p_auth_user_id
      and not exists (
        select 1
        from private.profile_auth_bindings b
        where b.auth_profile_id = p_auth_user_id
           or b.public_profile_id = p_auth_user_id
      )
  )
  select coalesce(
    (select eb.public_profile_id from explicit_binding eb),
    (select ef.public_profile_id from exact_id_fallback ef)
  );
$$;

revoke all on function private.resolve_service_os_business_profile_id(uuid)
  from public, anon, authenticated;
grant execute on function private.resolve_service_os_business_profile_id(uuid)
  to service_role;

-- PostgREST exposes only public. This invoker wrapper cannot elevate the
-- caller: the private function and schema require service_role privileges.
create function public.resolve_service_os_business_profile_id(p_auth_user_id uuid)
returns uuid
language sql stable security invoker
set search_path = ''
as $$
  select private.resolve_service_os_business_profile_id(p_auth_user_id);
$$;

revoke all on function public.resolve_service_os_business_profile_id(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_service_os_business_profile_id(uuid)
  to service_role;

commit;
