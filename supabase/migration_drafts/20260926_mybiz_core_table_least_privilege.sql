-- DRAFT ONLY. Apply after the verified identity/provisioning drafts and an
-- exact Production catalog/backup preflight. No Production execution here.
begin;

do $guard$
begin
  if to_regclass('public.stores') is null
    or to_regclass('public.store_members') is null
    or to_regclass('public.store_subscriptions') is null
    or to_regprocedure('public.is_store_member(uuid)') is null
    or to_regprocedure('public.create_store_with_verified_owner(uuid,text,text,text,text,text,text,text,text,text)') is null then
    raise exception 'V3_CORE_FOUNDATION_MISSING';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'public' and
        ((tablename = 'stores' and policyname = 'stores_member_access') or
         (tablename = 'store_subscriptions' and policyname = 'store_subscriptions_member_access') or
         (tablename = 'store_members' and policyname in
           ('store_members_select_member','store_members_insert_member','store_members_update_member')))) <> 5
    or (select count(*) from pg_policies where schemaname='public'
      and tablename in ('stores','store_members','store_subscriptions')) <> 5 then
    raise exception 'V3_CORE_POLICY_DRIFT';
  end if;
end;
$guard$;

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_subscriptions enable row level security;

-- Revoke inherited table CRUD and any legacy column grants. Service role is
-- granted explicitly; merchant writes use only four settings columns.
revoke all on public.stores, public.store_members, public.store_subscriptions
  from public, anon, authenticated;
do $columns$
declare
  target record;
  column_name record;
begin
  for target in select unnest(array['stores','store_members','store_subscriptions']) as name loop
    for column_name in select a.attname from pg_attribute a
      where a.attrelid = format('public.%I', target.name)::regclass
        and a.attnum > 0 and not a.attisdropped loop
      execute format('revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on public.%2$I from public, anon, authenticated',
        column_name.attname, target.name);
    end loop;
  end loop;
end;
$columns$;

grant select on public.stores, public.store_members, public.store_subscriptions
  to authenticated;
grant update (name, timezone, brand_config, slug) on public.stores
  to authenticated;
grant all on public.stores, public.store_members, public.store_subscriptions
  to service_role;

drop policy stores_member_access on public.stores;
create policy stores_select_member on public.stores for select to authenticated
  using (public.is_store_member(store_id));
create policy stores_update_member on public.stores for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

drop policy store_members_insert_member on public.store_members;
drop policy store_members_update_member on public.store_members;
-- Keep the existing SELECT policy and its exact predicate unchanged.

drop policy store_subscriptions_member_access on public.store_subscriptions;
create policy store_subscriptions_select_member on public.store_subscriptions
  for select to authenticated using (public.is_store_member(store_id));

do $assert$
declare
  target text;
  column_name text;
begin
  foreach target in array array['stores','store_members','store_subscriptions'] loop
    if has_any_column_privilege('anon', format('public.%I', target), 'SELECT')
      or has_any_column_privilege('anon', format('public.%I', target), 'INSERT')
      or has_any_column_privilege('anon', format('public.%I', target), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', target), 'DELETE') then
      raise exception 'V3_ANON_CORE_PRIVILEGE_REMAINS: %', target;
    end if;
  end loop;
  if has_any_column_privilege('authenticated','public.store_members','INSERT')
    or has_any_column_privilege('authenticated','public.store_members','UPDATE')
    or has_table_privilege('authenticated','public.store_members','DELETE')
    or has_any_column_privilege('authenticated','public.store_subscriptions','INSERT')
    or has_any_column_privilege('authenticated','public.store_subscriptions','UPDATE')
    or has_table_privilege('authenticated','public.store_subscriptions','DELETE')
    or has_any_column_privilege('authenticated','public.stores','INSERT')
    or has_table_privilege('authenticated','public.stores','DELETE') then
    raise exception 'V3_AUTH_CORE_WRITE_PRIVILEGE_REMAINS';
  end if;
  for column_name in select unnest(array['plan','trial_ends_at']) loop
    if has_column_privilege('authenticated','public.stores',column_name,'UPDATE') then
      raise exception 'V3_ENTITLEMENT_COLUMN_UPDATE_REMAINS: %', column_name;
    end if;
  end loop;
end;
$assert$;

commit;
