-- DRAFT ONLY. Server-side verified Auth/profile binding lookup.
-- Do not apply to Production without exact DB identity, backup and approval.
begin;

do $guard$
begin
  if to_regclass('private.profile_auth_bindings') is null
     or to_regclass('core.profiles') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Existing Auth/profile binding foundation is required';
  end if;
  if to_regprocedure('public.resolve_verified_merchant_profile_for_server(uuid)') is not null then
    raise exception 'Existing merchant profile resolver must be reviewed before replacement';
  end if;
end;
$guard$;

create function public.resolve_verified_merchant_profile_for_server(p_auth_user_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $body$
  select case when count(*) = 1 then min(b.public_profile_id) else null end
  from private.profile_auth_bindings b
  join core.profiles cp on cp.id = b.auth_profile_id and cp.is_active
  join auth.users au on au.id = b.auth_profile_id
  join public.profiles pp on pp.id = b.public_profile_id
  where p_auth_user_id is not null
    and b.auth_profile_id = p_auth_user_id
    and b.status = 'ACTIVE'
    and b.revoked_at is null;
$body$;

revoke all on function public.resolve_verified_merchant_profile_for_server(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_verified_merchant_profile_for_server(uuid)
  to service_role;

commit;
