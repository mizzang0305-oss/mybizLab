begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select is((select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests']) and c.relrowsecurity),
  15::bigint, 'all 15 RLS flags remain enabled after safe rollback');

select is((select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests']) t(name)
  where has_table_privilege('anon',format('public.%I',name),'SELECT')
     or has_table_privilege('anon',format('public.%I',name),'INSERT')
     or has_table_privilege('anon',format('public.%I',name),'UPDATE')
     or has_table_privilege('anon',format('public.%I',name),'DELETE')),
  0::bigint, 'anon direct CRUD remains zero');

select is((select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests']) t(name)
  where has_table_privilege('authenticated',format('public.%I',name),'SELECT')
     or has_table_privilege('authenticated',format('public.%I',name),'INSERT')
     or has_table_privilege('authenticated',format('public.%I',name),'UPDATE')
     or has_table_privilege('authenticated',format('public.%I',name),'DELETE')),
  0::bigint, 'all authenticated direct CRUD is held');

select is((select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests']) t(name)
  where has_table_privilege('service_role',format('public.%I',name),'SELECT')
    and has_table_privilege('service_role',format('public.%I',name),'INSERT')
    and has_table_privilege('service_role',format('public.%I',name),'UPDATE')
    and has_table_privilege('service_role',format('public.%I',name),'DELETE')),
  15::bigint, 'service-role CRUD remains available');

select ok(not public.is_bound_store_member('22222222-2222-4222-8222-222222222222'),
  'without a verified JWT the binding helper denies cross-store access');

select is((select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array['stores','store_members','store_subscriptions'])
    and c.relrowsecurity),3::bigint,'core RLS remains enabled');
select is((select count(*)::bigint from unnest(array['stores','store_members','store_subscriptions']) t(name)
  where has_any_column_privilege('anon',format('public.%I',name),'SELECT')
    or has_any_column_privilege('anon',format('public.%I',name),'INSERT')
    or has_any_column_privilege('anon',format('public.%I',name),'UPDATE')
    or has_table_privilege('anon',format('public.%I',name),'DELETE')),
  0::bigint,'core anon CRUD remains zero');
select ok(not has_any_column_privilege('authenticated','public.stores','UPDATE')
  and not has_any_column_privilege('authenticated','public.store_members','UPDATE')
  and not has_any_column_privilege('authenticated','public.store_subscriptions','UPDATE'),
  'core client writes paused without restoring broad access');

select * from finish();
rollback;
