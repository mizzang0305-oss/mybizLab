-- Local-only catalog checks. No Production data or function call.
do $assert$
declare
  old_count integer;
  old_browser_executable integer;
  new_oid oid;
begin
  select count(*), count(*) filter (
    where has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) into old_count, old_browser_executable
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_store_with_owner';
  if old_count < 1 or old_browser_executable <> 0 then
    raise exception 'R3_OLD_RPC_BROWSER_ACL_FAILED';
  end if;

  select to_regprocedure('public.provision_store_from_verified_actor(uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text)')::oid
  into new_oid;
  if new_oid is null
    or has_function_privilege('anon', new_oid, 'EXECUTE')
    or has_function_privilege('authenticated', new_oid, 'EXECUTE')
    or not has_function_privilege('service_role', new_oid, 'EXECUTE') then
    raise exception 'R3_NEW_RPC_ROLE_ACL_FAILED';
  end if;
  if has_table_privilege('anon', 'private.store_provisioning_receipts', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'private.store_provisioning_receipts', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'R3_RECEIPT_BROWSER_ACL_FAILED';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'private.store_provisioning_receipts'::regclass) then
    raise exception 'R3_RECEIPT_RLS_DISABLED';
  end if;
  if (select count(*) from private.store_provisioning_release_control) <> 1
    or (select mode from private.store_provisioning_release_control where singleton=true) <> 'HOLD'
    or not (select relrowsecurity from pg_class where oid = 'private.store_provisioning_release_control'::regclass)
    or has_table_privilege('anon', 'private.store_provisioning_release_control', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'private.store_provisioning_release_control', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'R4_RELEASE_CONTROL_BASELINE_FAILED';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.store_public_pages'::regclass
    and tgname='store_public_pages_provisioning_hold' and not tgisinternal) then
    raise exception 'R4_PRIVATE_PAGE_TRIGGER_MISSING';
  end if;
end;
$assert$;
