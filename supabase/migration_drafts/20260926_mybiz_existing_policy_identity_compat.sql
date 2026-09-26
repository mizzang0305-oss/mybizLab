-- DRAFT ONLY. Apply only after an exact Production preflight and Owner approval.
-- Preserve the public function contract and all existing policy SQL/ACL.
do $$
declare
  member_function oid := to_regprocedure('public.is_store_member(uuid)');
begin
  if to_regprocedure('private.current_service_os_business_profile_id()') is null
    or to_regprocedure('private.is_service_os_store_member(uuid)') is null
    or member_function is null then
    raise exception 'SERVICE_OS_IDENTITY_FOUNDATION_MISSING';
  end if;

  if (select pg_get_function_result(member_function)) <> 'boolean' then
    raise exception 'IS_STORE_MEMBER_CONTRACT_DRIFT';
  end if;
end;
$$;

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.is_service_os_store_member(target_store_id), false);
$$;
