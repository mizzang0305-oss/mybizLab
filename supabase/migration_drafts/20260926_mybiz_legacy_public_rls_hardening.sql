-- DRAFT ONLY: validated in ephemeral Supabase before any Production approval.
-- Restores RLS / least-privilege boundaries on legacy MyBiz public tables that
-- are currently exposed to anon/authenticated roles in Production.
-- Do not apply directly to Production from this draft path.

-- Apply the separately reviewed R1 resolver draft first. This gate reuses
-- that one canonical identity resolution and never replaces it implicitly.
do $guard$
begin
  if to_regprocedure('public.resolve_verified_merchant_profile_for_server(uuid)') is null then
    raise exception 'Verified merchant profile resolver must be applied first';
  end if;
end;
$guard$;

-- The existing is_store_member(uuid) has callers outside this gate and assumes
-- auth.uid() = store_members.profile_id. Keep it intact. These policies use a
-- separate, binding-aware predicate. Only a unique, active, verified identity
-- and a membership for the requested store can produce true.
create or replace function public.is_bound_store_member(target_store_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $body$
  select exists (
    select 1 from public.store_members sm
    where sm.profile_id = public.resolve_verified_merchant_profile_for_server(auth.uid())
      and sm.store_id = target_store_id
  );
$body$;
revoke all on function public.is_bound_store_member(uuid) from public, anon, authenticated;
grant execute on function public.is_bound_store_member(uuid) to authenticated;

-- 1) Enable RLS on every exposed legacy table found by the Production security gate.
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

-- 2) Remove the current broad Data API grants from public client roles.
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

-- Keep server-side service-role compatibility explicit.
grant select, insert, update, delete on table public.store_tables to service_role;
grant select, insert, update, delete on table public.sessions to service_role;
grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.events to service_role;
grant select, insert, update, delete on table public.menu_categories to service_role;
grant select, insert, update, delete on table public.menu_items to service_role;
grant select, insert, update, delete on table public.store_staff to service_role;
grant select, insert, update, delete on table public.store_modules to service_role;
grant select, insert, update, delete on table public.ai_briefing_logs to service_role;
grant select, insert, update, delete on table public.store_analytics_profile to service_role;
grant select, insert, update, delete on table public.store_priority_settings to service_role;
grant select, insert, update, delete on table public.store_daily_metrics to service_role;
grant select, insert, update, delete on table public.ai_reports to service_role;
grant select, insert, update, delete on table public.store_home_content to service_role;
grant select, insert, update, delete on table public.store_setup_requests to service_role;

-- 3) Only operations used by current browser merchant paths are granted.
-- DELETE has no verified browser caller. Public writes use server APIs.
drop policy if exists "store_tables_member_access" on public.store_tables;
create policy "store_tables_member_access"
on public.store_tables
for select
to authenticated
using (public.is_bound_store_member(store_id));
create policy "store_tables_member_insert" on public.store_tables
for insert to authenticated with check (public.is_bound_store_member(store_id));
grant select, insert on table public.store_tables to authenticated;

drop policy if exists "orders_member_access" on public.orders;
create policy "orders_member_access"
on public.orders
for select
to authenticated
using (public.is_bound_store_member(store_id));
create policy "orders_member_update" on public.orders
for update to authenticated
using (public.is_bound_store_member(store_id))
with check (public.is_bound_store_member(store_id));
grant select, update on table public.orders to authenticated;

drop policy if exists "menu_categories_member_access" on public.menu_categories;
create policy "menu_categories_member_access"
on public.menu_categories
for select
to authenticated
using (public.is_bound_store_member(store_id));
create policy "menu_categories_member_insert" on public.menu_categories
for insert to authenticated with check (public.is_bound_store_member(store_id));
grant select, insert on table public.menu_categories to authenticated;

drop policy if exists "menu_items_member_access" on public.menu_items;
create policy "menu_items_member_access"
on public.menu_items
for select
to authenticated
using (public.is_bound_store_member(store_id));
create policy "menu_items_member_insert" on public.menu_items
for insert to authenticated with check (public.is_bound_store_member(store_id));
grant select, insert on table public.menu_items to authenticated;

-- Production stores these legacy store IDs as text. Production preflight verified
-- all existing values in these tables are UUID-shaped. CASE avoids invalid casts
-- for any future malformed legacy row.
drop policy if exists "store_priority_settings_member_access" on public.store_priority_settings;
create policy "store_priority_settings_member_access"
on public.store_priority_settings
for select
to authenticated
using (
  case
    when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_bound_store_member(store_id::uuid)
    else false
  end
);
create policy "store_priority_settings_member_insert" on public.store_priority_settings
for insert to authenticated
with check (
  case
    when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_bound_store_member(store_id::uuid)
    else false
  end
);
create policy "store_priority_settings_member_update" on public.store_priority_settings
for update to authenticated
using (
  case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_bound_store_member(store_id::uuid) else false end
)
with check (
  case when store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_bound_store_member(store_id::uuid) else false end
);
grant select, insert, update on table public.store_priority_settings to authenticated;

drop policy if exists "store_daily_metrics_member_access" on public.store_daily_metrics;

drop policy if exists "ai_reports_member_access" on public.ai_reports;

drop policy if exists "store_home_content_member_access" on public.store_home_content;

-- 4) Store setup requests are written by the server-side onboarding API.
-- The pre-existing own-row policy shape is preserved, but direct client grants
-- are withheld until a browser caller is verified.
drop policy if exists "setup_requests_manage_own" on public.store_setup_requests;
drop policy if exists "setup_requests_select_own" on public.store_setup_requests;
drop policy if exists "setup_requests_update_own" on public.store_setup_requests;

create policy "setup_requests_select_own"
on public.store_setup_requests
for select
to authenticated
using (auth.uid() = created_by);

create policy "setup_requests_update_own"
on public.store_setup_requests
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

-- No authenticated browser caller needs setup-request direct writes or reads.
-- Leave the policies in place for a narrowly approved future path, but keep
-- the table inaccessible through direct PostgREST grants.

-- 5) Remaining target tables are server-only or legacy fallback. No client
-- grants/policies: sessions, events, store_staff, store_modules,
-- ai_briefing_logs, store_analytics_profile, store_daily_metrics, ai_reports,
-- store_home_content, store_setup_requests.

-- 6) Slug generation is an internal helper of the server-side provisioning RPC.
-- There is no client RPC caller in the current source tree.
revoke execute on function public.generate_unique_store_slug(text) from public;
revoke execute on function public.generate_unique_store_slug(text) from anon;
revoke execute on function public.generate_unique_store_slug(text) from authenticated;
grant execute on function public.generate_unique_store_slug(text) to service_role;

-- The verified-owner server RPC replaces this legacy entry point. Keep the
-- object for separately approved recovery, but remove all client/API roles.
revoke execute on function public.create_store_with_owner(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
