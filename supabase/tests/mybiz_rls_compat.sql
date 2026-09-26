begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- All IDs and rows in this file are synthetic and exist only on the CI runner.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'store-a@example.invalid', '{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'store-b@example.invalid', '{}'::jsonb),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bound-owner@example.invalid', '{}'::jsonb),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'no-store@example.invalid', '{}'::jsonb);
insert into core.profiles (id, is_active) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
insert into public.profiles (id, full_name, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Store A owner', 'store-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Store B owner', 'store-b@example.invalid'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Bound public owner', 'bound-public@example.invalid');
insert into private.profile_auth_bindings (
  public_profile_id, auth_profile_id, binding_source, status
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'OWNER_VERIFIED',
  'ACTIVE'
);
insert into public.stores (store_id, slug, name) values
  ('11111111-1111-4111-8111-111111111111', 'store-a', 'Store A'),
  ('22222222-2222-4222-8222-222222222222', 'store-b', 'Store B');
insert into public.store_members (store_id, profile_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-4111-8111-111111111111', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner');
insert into public.store_tables (store_id, table_no) values
  ('11111111-1111-4111-8111-111111111111', 1),
  ('22222222-2222-4222-8222-222222222222', 2);
insert into public.orders (store_id, total_amount) values
  ('11111111-1111-4111-8111-111111111111', 1000),
  ('22222222-2222-4222-8222-222222222222', 2000);
insert into public.menu_categories (store_id, name) values
  ('11111111-1111-4111-8111-111111111111', 'A'),
  ('22222222-2222-4222-8222-222222222222', 'B');
insert into public.menu_items (store_id, name, price) values
  ('11111111-1111-4111-8111-111111111111', 'A', 1000),
  ('22222222-2222-4222-8222-222222222222', 'B', 2000);
insert into public.store_priority_settings (store_id, version) values
  ('11111111-1111-4111-8111-111111111111', 1),
  ('22222222-2222-4222-8222-222222222222', 1);

select is((select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname = any(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
    'store_setup_requests']) and c.relrowsecurity), 15::bigint, 'all 15 RLS enabled');

select is((select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
    'store_setup_requests']) as t(name)
  where has_table_privilege('anon',format('public.%I',name),'SELECT')
     or has_table_privilege('anon',format('public.%I',name),'INSERT')
     or has_table_privilege('anon',format('public.%I',name),'UPDATE')
     or has_table_privilege('anon',format('public.%I',name),'DELETE')),
  0::bigint, 'anon has no direct CRUD on target tables');
select is((select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
    'store_setup_requests']) as t(name)
  where has_table_privilege('authenticated',format('public.%I',name),'DELETE')),
  0::bigint, 'authenticated cannot delete any target table');
select ok(not has_function_privilege('anon','public.generate_unique_store_slug(text)','EXECUTE'),
  'anon cannot execute slug helper');
select ok(not has_function_privilege('authenticated','public.generate_unique_store_slug(text)','EXECUTE'),
  'authenticated cannot execute slug helper directly');
select ok(has_function_privilege('authenticated','private.is_service_os_store_member(uuid)','EXECUTE'),
  'verified Service OS membership helper remains callable');
select ok(not has_function_privilege('anon','private.is_service_os_store_member(uuid)','EXECUTE'),
  'anonymous clients cannot execute the private membership helper');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
select is((select count(*)::bigint from public.store_tables),1::bigint,'Store A sees own table only');
select is((select count(*)::bigint from public.menu_categories),1::bigint,'Store A sees own category only');
select is((select count(*)::bigint from public.menu_items),1::bigint,'Store A sees own menu item only');
select is((select count(*)::bigint from public.store_priority_settings),1::bigint,'Store A sees own priority settings only');
select throws_ok($$select * from public.orders$$,'42501',null,'merchant direct order read is blocked');
select lives_ok($$insert into public.store_tables(store_id,table_no)
  values ('11111111-1111-4111-8111-111111111111',3)$$,'own store table insert allowed');
select throws_ok($$insert into public.store_tables(store_id,table_no)
  values ('22222222-2222-4222-8222-222222222222',4)$$,'42501',null,'cross store table insert denied');
select lives_ok($$insert into public.menu_categories(store_id,name)
  values ('11111111-1111-4111-8111-111111111111','Own')$$,'own category insert allowed');
select throws_ok($$insert into public.menu_categories(store_id,name)
  values ('22222222-2222-4222-8222-222222222222','Denied')$$,'42501',null,'cross store category insert denied');
select lives_ok($$update public.store_priority_settings set version=2
  where store_id='22222222-2222-4222-8222-222222222222'$$,
  'cross store priority update cannot mutate an invisible row');
reset role;
select is((select version from public.store_priority_settings
  where store_id='22222222-2222-4222-8222-222222222222'),1,
  'Store B priority row was not changed by Store A');

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
set local role authenticated;
select is((select count(*)::bigint from public.store_tables),1::bigint,
  'verified Auth/profile binding sees the bound store only');
select is((select count(*)::bigint from public.store_priority_settings),1::bigint,
  'verified binding authorizes priority settings for the bound store');
reset role;

select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
set local role authenticated;
select is((select count(*)::bigint from public.store_tables),0::bigint,'nonmember sees no store tables');
select is((select count(*)::bigint from public.store_priority_settings),0::bigint,'nonmember sees no priority settings');
reset role;

set local role service_role;
select is((select count(*)::bigint from public.orders),2::bigint,'server role can read both stores');
select is((select count(*)::bigint from public.store_tables),3::bigint,'server role sees both store tables');
reset role;

select * from finish();
rollback;
