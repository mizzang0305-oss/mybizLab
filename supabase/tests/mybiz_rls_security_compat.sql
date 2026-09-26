begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Synthetic Auth IDs differ from their public profile IDs.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-a@example.invalid', '{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-b@example.invalid', '{}'::jsonb),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'rls-unbound@example.invalid', '{}'::jsonb);
insert into core.profiles (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.profiles (id) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into private.profile_auth_bindings
  (auth_profile_id, public_profile_id, binding_source) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'OWNER_VERIFIED'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'OWNER_VERIFIED');

-- Seed two stores and two independent owners.
insert into public.stores (store_id, slug, name) values
  ('11111111-1111-4111-8111-111111111111', 'store-a', 'Store A'),
  ('22222222-2222-4222-8222-222222222222', 'store-b', 'Store B');

insert into public.store_members (store_id, profile_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'owner');

insert into public.store_tables (store_id, table_no) values
  ('11111111-1111-4111-8111-111111111111', 1),
  ('22222222-2222-4222-8222-222222222222', 2);

insert into public.orders (store_id, total_amount) values
  ('11111111-1111-4111-8111-111111111111', 1000),
  ('22222222-2222-4222-8222-222222222222', 2000);

insert into public.menu_categories (store_id, name) values
  ('11111111-1111-4111-8111-111111111111', 'A category'),
  ('22222222-2222-4222-8222-222222222222', 'B category');

insert into public.menu_items (store_id, name, price) values
  ('11111111-1111-4111-8111-111111111111', 'A item', 1000),
  ('22222222-2222-4222-8222-222222222222', 'B item', 2000);

insert into public.store_priority_settings (store_id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.store_daily_metrics (store_id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.ai_reports (store_id, summary) values
  ('11111111-1111-4111-8111-111111111111', 'A'),
  ('22222222-2222-4222-8222-222222222222', 'B');

insert into public.store_home_content (store_id, hero_title) values
  ('11111111-1111-4111-8111-111111111111', 'A'),
  ('22222222-2222-4222-8222-222222222222', 'B');

insert into public.store_setup_requests (id, created_by, business_name, owner_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A request', 'A owner'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B request', 'B owner');

-- 1. Every table identified by the Production security gate must now have RLS.
select is(
  (
    select count(*)::bigint
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'store_tables','sessions','orders','events','menu_categories','menu_items',
        'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
        'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
        'store_setup_requests'
      )
      and not c.relrowsecurity
  ),
  0::bigint,
  'all 15 exposed legacy tables have RLS enabled'
);

-- 2. Anon must have no direct CRUD privilege on any of the 15 tables.
select is(
  (
    select count(*)::bigint
    from unnest(array[
      'store_tables','sessions','orders','events','menu_categories','menu_items',
      'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
      'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
      'store_setup_requests'
    ]) as t(name)
    where has_table_privilege('anon', format('public.%I', name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', name), 'DELETE')
  ),
  0::bigint,
  'anon has zero direct CRUD privileges across all 15 tables'
);

-- 3. Server-only/quarantined tables must also be unavailable to authenticated clients.
select is(
  (
    select count(*)::bigint
    from unnest(array[
      'sessions','events','store_staff','store_modules','ai_briefing_logs','store_analytics_profile'
    ]) as t(name)
    where has_table_privilege('authenticated', format('public.%I', name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', name), 'DELETE')
  ),
  0::bigint,
  'authenticated clients have no direct CRUD on server-only legacy tables'
);

-- 4. Server role keeps deterministic CRUD access for server APIs.
select is(
  (
    select count(*)::bigint
    from unnest(array[
      'store_tables','sessions','orders','events','menu_categories','menu_items',
      'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
      'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
      'store_setup_requests'
    ]) as t(name)
    where has_table_privilege('service_role', format('public.%I', name), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', name), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', name), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', name), 'DELETE')
  ),
  15::bigint,
  'service_role keeps CRUD access on all 15 tables'
);

-- Browser merchant grants match the observed client operations, not RIUD.
select ok(
  has_table_privilege('authenticated','public.store_tables','SELECT')
  and has_table_privilege('authenticated','public.store_tables','INSERT')
  and not has_table_privilege('authenticated','public.store_tables','UPDATE')
  and not has_table_privilege('authenticated','public.store_tables','DELETE'),
  'store_tables auth grant is R,I');
select ok(
  has_table_privilege('authenticated','public.orders','SELECT')
  and has_table_privilege('authenticated','public.orders','UPDATE')
  and not has_table_privilege('authenticated','public.orders','INSERT')
  and not has_table_privilege('authenticated','public.orders','DELETE'),
  'orders auth grant is R,U');
select ok(
  has_table_privilege('authenticated','public.menu_categories','SELECT')
  and has_table_privilege('authenticated','public.menu_categories','INSERT')
  and not has_table_privilege('authenticated','public.menu_categories','UPDATE')
  and not has_table_privilege('authenticated','public.menu_categories','DELETE'),
  'menu_categories auth grant is R,I');
select ok(
  has_table_privilege('authenticated','public.menu_items','SELECT')
  and has_table_privilege('authenticated','public.menu_items','INSERT')
  and not has_table_privilege('authenticated','public.menu_items','UPDATE')
  and not has_table_privilege('authenticated','public.menu_items','DELETE'),
  'menu_items auth grant is R,I');
select ok(
  has_table_privilege('authenticated','public.store_priority_settings','SELECT')
  and has_table_privilege('authenticated','public.store_priority_settings','INSERT')
  and has_table_privilege('authenticated','public.store_priority_settings','UPDATE')
  and not has_table_privilege('authenticated','public.store_priority_settings','DELETE'),
  'priority auth grant is R,I,U');
select is((
  select count(*)::bigint from unnest(array[
    'sessions','events','store_staff','store_modules','ai_briefing_logs',
    'store_analytics_profile','store_daily_metrics','ai_reports',
    'store_home_content','store_setup_requests']) t(name)
  where has_table_privilege('authenticated',format('public.%I',name),'SELECT')
     or has_table_privilege('authenticated',format('public.%I',name),'INSERT')
     or has_table_privilege('authenticated',format('public.%I',name),'UPDATE')
     or has_table_privilege('authenticated',format('public.%I',name),'DELETE')
), 0::bigint, 'ten server-only targets have zero authenticated CRUD');
select is((
  select count(*)::bigint from unnest(array[
    'store_tables','sessions','orders','events','menu_categories','menu_items',
    'store_staff','store_modules','ai_briefing_logs','store_analytics_profile',
    'store_priority_settings','store_daily_metrics','ai_reports','store_home_content',
    'store_setup_requests']) t(name)
  where has_table_privilege('authenticated',format('public.%I',name),'DELETE')
), 0::bigint, 'authenticated DELETE is ungranted on all 15');

-- 9-11. The internal slug helper is no longer callable from public client roles.
select ok(not has_function_privilege('anon', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'anon cannot execute slug helper');
select ok(not has_function_privilege('authenticated', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'authenticated cannot execute slug helper directly');
select ok(has_function_privilege('service_role', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'service_role can execute slug helper');
select ok(not has_function_privilege('anon','public.is_bound_store_member(uuid)','EXECUTE'), 'anon cannot execute binding helper');
select ok(has_function_privilege('authenticated','public.is_bound_store_member(uuid)','EXECUTE'), 'authenticated can call binding helper');
select ok(not has_function_privilege('anon','public.resolve_verified_merchant_profile_for_server(uuid)','EXECUTE'), 'anon cannot execute server resolver');
select ok(not has_function_privilege('authenticated','public.resolve_verified_merchant_profile_for_server(uuid)','EXECUTE'), 'authenticated cannot execute server resolver');
select ok(has_function_privilege('service_role','public.resolve_verified_merchant_profile_for_server(uuid)','EXECUTE'), 'service role can execute server resolver');
select ok((select p.prosecdef and exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%')
  from pg_proc p where p.oid='public.is_bound_store_member(uuid)'::regprocedure),
  'binding helper is definer with a fixed search path');
select ok((select p.prosecdef and exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%')
  from pg_proc p where p.oid='public.resolve_verified_merchant_profile_for_server(uuid)'::regprocedure),
  'server resolver is definer with a fixed search path');
select ok(not has_function_privilege('authenticated','public.create_store_with_owner(text,text,text,text,text,text,text,text,text)','EXECUTE'), 'authenticated cannot provision directly');
select ok(has_function_privilege('service_role','public.create_store_with_owner(text,text,text,text,text,text,text,text,text)','EXECUTE'), 'service role can provision through RPC');

-- Simulate Store A's authenticated owner session.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- Non-identical binding permits exactly Store A for Store A's Auth JWT.
select is((select count(*) from public.store_tables)::bigint, 1::bigint, 'member sees only own store_tables');
select is((select count(*) from public.orders)::bigint, 1::bigint, 'member sees only own orders');
select is((select count(*) from public.menu_categories)::bigint, 1::bigint, 'member sees only own menu_categories');
select is((select count(*) from public.menu_items)::bigint, 1::bigint, 'member sees only own menu_items');
select is((select count(*) from public.store_priority_settings)::bigint, 1::bigint, 'member sees only own priority settings');
select ok(public.is_bound_store_member('11111111-1111-4111-8111-111111111111'), 'nonidentical Auth/profile binding grants Store A');
select ok(not public.is_bound_store_member('22222222-2222-4222-8222-222222222222'), 'binding helper denies Store B');
select lives_ok($$insert into public.store_tables(store_id,table_no) values
  ('11111111-1111-4111-8111-111111111111',2)$$, 'own-store table INSERT');
select lives_ok($$insert into public.menu_categories(store_id,name) values
  ('11111111-1111-4111-8111-111111111111','Own')$$, 'own-store category INSERT');
select lives_ok($$insert into public.menu_items(store_id,name,price) values
  ('11111111-1111-4111-8111-111111111111','Own',300)$$, 'own-store menu INSERT');
with changed as (update public.orders set status='submitted'
  where store_id='11111111-1111-4111-8111-111111111111' returning 1)
select is((select count(*)::bigint from changed), 1::bigint, 'own-store order UPDATE');
with changed as (update public.store_priority_settings set version=2
  where store_id='11111111-1111-4111-8111-111111111111' returning 1)
select is((select count(*)::bigint from changed), 1::bigint, 'own-store priority UPDATE');
select throws_ok($$insert into public.store_tables(store_id,table_no) values
  ('22222222-2222-4222-8222-222222222222',3)$$, '42501', null, 'cross-store table INSERT denied');
select throws_ok($$insert into public.menu_categories(store_id,name) values
  ('22222222-2222-4222-8222-222222222222','Denied')$$, '42501', null, 'cross-store category INSERT denied');
select throws_ok($$insert into public.menu_items(store_id,name,price) values
  ('22222222-2222-4222-8222-222222222222','Denied',300)$$, '42501', null, 'cross-store menu INSERT denied');
with changed as (update public.orders set status='submitted'
  where store_id='22222222-2222-4222-8222-222222222222' returning 1)
select is((select count(*)::bigint from changed), 0::bigint, 'cross-store order UPDATE blocked');
with changed as (update public.store_priority_settings set version=3
  where store_id='22222222-2222-4222-8222-222222222222' returning 1)
select is((select count(*)::bigint from changed), 0::bigint, 'cross-store priority UPDATE blocked');

reset role;

-- Revocation, inactive identity, missing membership, conflicting binding,
-- unbound Auth and other-store-only identities fail closed.
update private.profile_auth_bindings set status='REVOKED', revoked_at=now()
  where auth_profile_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select ok(not public.is_bound_store_member('11111111-1111-4111-8111-111111111111'),
  'revoked binding denied');
reset role;
update private.profile_auth_bindings set status='ACTIVE', revoked_at=null
  where auth_profile_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update core.profiles set is_active=false where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select ok(not public.is_bound_store_member('11111111-1111-4111-8111-111111111111'),
  'inactive core profile denied');
reset role;
update core.profiles set is_active=true where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.store_members where store_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select ok(not public.is_bound_store_member('11111111-1111-4111-8111-111111111111'),
  'missing membership denied');
reset role;
insert into public.store_members(store_id,profile_id,role) values
  ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner');
select throws_ok($$insert into private.profile_auth_bindings
  (auth_profile_id,public_profile_id,binding_source) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff','OWNER_VERIFIED')$$,
  '23505', null, 'duplicate active binding rejected by unique index');
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
set local role authenticated;
select ok(not public.is_bound_store_member('11111111-1111-4111-8111-111111111111'),
  'unbound Auth identity denied');
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
select ok(not public.is_bound_store_member('11111111-1111-4111-8111-111111111111'),
  'Store B identity denied Store A');
reset role;

-- Service role bypass path still sees both rows for server-side public APIs.
set local role service_role;
select ok(
  (select count(*) from public.store_tables where store_id='11111111-1111-4111-8111-111111111111') >= 1
  and (select count(*) from public.store_tables where store_id='22222222-2222-4222-8222-222222222222') = 1,
  'service role sees both stores for server API work');

-- 24. Service role can execute internal provisioning slug helper.
select lives_ok(
  $$ select public.generate_unique_store_slug('Synthetic Store') $$,
  'service role can execute internal slug helper'
);
reset role;

-- 25. No policies are created on intentionally server-only legacy tables.
select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sessions','events','store_staff','store_modules','ai_briefing_logs','store_analytics_profile')
  ),
  0::bigint,
  'server-only legacy tables have no client RLS policies'
);

select * from finish();
rollback;
