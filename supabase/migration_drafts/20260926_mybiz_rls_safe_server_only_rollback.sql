-- DRAFT ONLY. Emergency compatibility HOLD for the exact V2 target.
-- Run only after an incident decision; this does not restore anon grants or
-- disable RLS. Client merchant writes pause while server-role paths remain.
begin;

revoke select, insert on public.store_tables from authenticated;
revoke select, update on public.orders from authenticated;
revoke select, insert on public.menu_categories from authenticated;
revoke select, insert on public.menu_items from authenticated;
revoke select, insert, update on public.store_priority_settings from authenticated;
-- V3 core-table HOLD: keep member reads but pause browser settings writes.
-- Initial subscriptions and owner membership remain server-only.
revoke update (name, timezone, brand_config, slug) on public.stores from authenticated;

-- Keep RLS and all restrictive policies in place. Revoking direct client
-- grants means cross-store access remains impossible during application HOLD.
do $guard$
declare target text;
begin
  foreach target in array array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests'
  ] loop
    if not (select c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=target) then
      raise exception 'Rollback invariant failed: RLS disabled for %', target;
    end if;
    if has_table_privilege('anon', format('public.%I',target), 'SELECT')
       or has_table_privilege('anon', format('public.%I',target), 'INSERT')
       or has_table_privilege('anon', format('public.%I',target), 'UPDATE')
       or has_table_privilege('anon', format('public.%I',target), 'DELETE') then
      raise exception 'Rollback invariant failed: anon grant on %', target;
    end if;
  end loop;
end;
$guard$;

do $core_guard$
declare target text;
begin
  foreach target in array array['stores','store_members','store_subscriptions'] loop
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=target) then
      raise exception 'Rollback invariant failed: core RLS disabled for %', target;
    end if;
    if has_any_column_privilege('anon',format('public.%I',target),'SELECT')
      or has_any_column_privilege('anon',format('public.%I',target),'INSERT')
      or has_any_column_privilege('anon',format('public.%I',target),'UPDATE')
      or has_table_privilege('anon',format('public.%I',target),'DELETE') then
      raise exception 'Rollback invariant failed: anon core grant on %', target;
    end if;
  end loop;
  if has_any_column_privilege('authenticated','public.stores','UPDATE')
    or has_any_column_privilege('authenticated','public.store_members','UPDATE')
    or has_any_column_privilege('authenticated','public.store_subscriptions','UPDATE') then
    raise exception 'Rollback invariant failed: browser core write remains';
  end if;
end;
$core_guard$;

commit;
