begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- Seed two stores and two independent owners.
insert into public.stores (store_id, slug, name) values
  ('11111111-1111-4111-8111-111111111111', 'store-a', 'Store A'),
  ('22222222-2222-4222-8222-222222222222', 'store-b', 'Store B');

insert into public.store_members (store_id, profile_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner');

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

-- 5. Merchant-facing tables keep authenticated CRUD; RLS supplies store isolation.
select is(
  (
    select count(*)::bigint
    from unnest(array[
      'store_tables','orders','menu_categories','menu_items',
      'store_priority_settings','store_daily_metrics','ai_reports','store_home_content'
    ]) as t(name)
    where has_table_privilege('authenticated', format('public.%I', name), 'SELECT')
      and has_table_privilege('authenticated', format('public.%I', name), 'INSERT')
      and has_table_privilege('authenticated', format('public.%I', name), 'UPDATE')
      and has_table_privilege('authenticated', format('public.%I', name), 'DELETE')
  ),
  8::bigint,
  'authenticated merchant role keeps RLS-scoped CRUD on eight merchant tables'
);

-- 6-8. Setup requests use server-side writes; users only read/update their own request.
select ok(has_table_privilege('authenticated', 'public.store_setup_requests', 'SELECT'), 'setup requests allow authenticated SELECT');
select ok(has_table_privilege('authenticated', 'public.store_setup_requests', 'UPDATE'), 'setup requests allow authenticated UPDATE');
select ok(
  not has_table_privilege('authenticated', 'public.store_setup_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.store_setup_requests', 'DELETE'),
  'setup requests do not allow authenticated INSERT/DELETE'
);

-- 9-11. The internal slug helper is no longer callable from public client roles.
select ok(not has_function_privilege('anon', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'anon cannot execute slug helper');
select ok(not has_function_privilege('authenticated', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'authenticated cannot execute slug helper directly');
select ok(has_function_privilege('service_role', 'public.generate_unique_store_slug(text)', 'EXECUTE'), 'service_role can execute slug helper');

-- Simulate Store A's authenticated owner session.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- 12-19. Store A owner sees only Store A rows on every member-scoped table.
select is((select count(*) from public.store_tables)::bigint, 1::bigint, 'member sees only own store_tables');
select is((select count(*) from public.orders)::bigint, 1::bigint, 'member sees only own orders');
select is((select count(*) from public.menu_categories)::bigint, 1::bigint, 'member sees only own menu_categories');
select is((select count(*) from public.menu_items)::bigint, 1::bigint, 'member sees only own menu_items');
select is((select count(*) from public.store_priority_settings)::bigint, 1::bigint, 'member sees only own priority settings');
select is((select count(*) from public.store_daily_metrics)::bigint, 1::bigint, 'member sees only own daily metrics');
select is((select count(*) from public.ai_reports)::bigint, 1::bigint, 'member sees only own AI reports');
select is((select count(*) from public.store_home_content)::bigint, 1::bigint, 'member sees only own legacy home content');

-- 20. Setup-request owner isolation.
select is((select count(*) from public.store_setup_requests)::bigint, 1::bigint, 'authenticated user sees only own setup request');

-- 21-22. Canonical store-membership helper is the authorization truth.
select ok(public.is_store_member('11111111-1111-4111-8111-111111111111'), 'Store A owner is recognized as Store A member');
select ok(not public.is_store_member('22222222-2222-4222-8222-222222222222'), 'Store A owner is not recognized as Store B member');

reset role;

-- 23. Service role bypass path still sees both rows for server-side public APIs.
set local role service_role;
select is((select count(*) from public.store_tables)::bigint, 2::bigint, 'service role sees both stores for server API work');

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
