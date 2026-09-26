-- DRAFT ONLY. Emergency compatibility HOLD for the exact V2 target.
-- Run only after an incident decision; this does not restore anon grants or
-- disable RLS. Client merchant writes pause while server-role paths remain.
begin;

revoke select, insert on public.store_tables from authenticated;
revoke select, update on public.orders from authenticated;
revoke select, insert on public.menu_categories from authenticated;
revoke select, insert on public.menu_items from authenticated;
revoke select, insert, update on public.store_priority_settings from authenticated;

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

commit;
