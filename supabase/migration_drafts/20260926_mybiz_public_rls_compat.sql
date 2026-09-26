-- REVIEW DRAFT ONLY. Apply to a disposable Production-like database first.
-- Production target: plnuyudyogbzwpmdulnw. Never apply without a separate approval.
-- The public storefront reads menu and tables through /api/public/store.
-- Merchant order reads and mutations use /api/merchant with verified Auth identity.
begin;

do $guard$
declare
  missing text;
begin
  select string_agg(name, ', ' order by name) into missing
  from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
    'store_setup_requests'
  ]) as target(name)
  where to_regclass(format('public.%I', name)) is null;

  if missing is not null then
    raise exception 'MyBiz RLS target tables missing: %', missing;
  end if;
  if to_regprocedure('public.is_store_member(uuid)') is null then
    raise exception 'Existing store membership helper is required';
  end if;
end;
$guard$;

-- Each table has an explicit disposition in the runtime access matrix.
alter table public.store_tables enable row level security;
alter table public.sessions enable row level security;
alter table public.orders enable row level security;
alter table public.events enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.store_staff enable row level security;
alter table public.store_modules enable row level security;
alter table public.ai_briefing_logs enable row level security;
alter table public.store_analytics_profile enable row level security;
alter table public.store_priority_settings enable row level security;
alter table public.store_daily_metrics enable row level security;
alter table public.ai_reports enable row level security;
alter table public.store_home_content enable row level security;
alter table public.store_setup_requests enable row level security;

revoke all on table public.store_tables from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.menu_categories from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.store_staff from anon, authenticated;
revoke all on table public.store_modules from anon, authenticated;
revoke all on table public.ai_briefing_logs from anon, authenticated;
revoke all on table public.store_analytics_profile from anon, authenticated;
revoke all on table public.store_priority_settings from anon, authenticated;
revoke all on table public.store_daily_metrics from anon, authenticated;
revoke all on table public.ai_reports from anon, authenticated;
revoke all on table public.store_home_content from anon, authenticated;
revoke all on table public.store_setup_requests from anon, authenticated;

-- Existing helper body uses schema-qualified references. Restrict lookup path.
alter function public.is_store_member(uuid) set search_path = '';
revoke execute on function public.is_store_member(uuid) from public, anon;
grant execute on function public.is_store_member(uuid) to authenticated;

-- Authenticated merchant editor: own store only. Public reads use the server API.
create policy mybiz_tables_member_select on public.store_tables
  for select to authenticated using (public.is_store_member(store_id));
create policy mybiz_tables_member_insert on public.store_tables
  for insert to authenticated with check (public.is_store_member(store_id));
grant select, insert on public.store_tables to authenticated;

create policy mybiz_categories_member_select on public.menu_categories
  for select to authenticated using (public.is_store_member(store_id));
create policy mybiz_categories_member_insert on public.menu_categories
  for insert to authenticated with check (public.is_store_member(store_id));
grant select, insert on public.menu_categories to authenticated;

create policy mybiz_items_member_select on public.menu_items
  for select to authenticated using (public.is_store_member(store_id));
create policy mybiz_items_member_insert on public.menu_items
  for insert to authenticated with check (public.is_store_member(store_id));
grant select, insert on public.menu_items to authenticated;

-- Production legacy priority settings use TEXT store_id, unlike the UUID membership key.
create policy mybiz_priority_member_select on public.store_priority_settings
  for select to authenticated using (
    case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_store_member(store_id::uuid) else false end
  );
create policy mybiz_priority_member_insert on public.store_priority_settings
  for insert to authenticated with check (
    case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_store_member(store_id::uuid) else false end
  );
create policy mybiz_priority_member_update on public.store_priority_settings
  for update to authenticated
  using (
    case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_store_member(store_id::uuid) else false end
  )
  with check (
    case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_store_member(store_id::uuid) else false end
  );
grant select, insert, update on public.store_priority_settings to authenticated;

-- The remaining 11 tables have no browser grant. Server service_role retains its
-- existing table privileges; this draft does not broaden them.
-- Do not revoke create_store_with_owner from authenticated until the existing
-- provisioning RPC signature/auth.uid() mismatch is resolved and tested.
revoke execute on function public.generate_unique_store_slug(text) from public, anon;

commit;
