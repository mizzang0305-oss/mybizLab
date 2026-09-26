begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','core-a@example.invalid','{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','core-b@example.invalid','{}'::jsonb);
insert into core.profiles(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.profiles(id) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into private.profile_auth_bindings(auth_profile_id,public_profile_id,binding_source) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','OWNER_VERIFIED'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd','OWNER_VERIFIED');
insert into public.stores(store_id,slug,name,plan) values
  ('11111111-1111-4111-8111-111111111111','core-a','A','pro'),
  ('22222222-2222-4222-8222-222222222222','core-b','B','vip');
insert into public.store_members(store_id,profile_id,role) values
  ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner'),
  ('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner');
insert into public.store_subscriptions(store_id,plan,status) values
  ('11111111-1111-4111-8111-111111111111','pro','active'),
  ('22222222-2222-4222-8222-222222222222','vip','active');

select is((select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('stores','store_members','store_subscriptions')
    and c.relrowsecurity), 3::bigint, 'all three core tables have RLS');
select is((select count(*)::bigint from unnest(array['stores','store_members','store_subscriptions']) t(name)
  where has_any_column_privilege('anon',format('public.%I',name),'SELECT')
    or has_any_column_privilege('anon',format('public.%I',name),'INSERT')
    or has_any_column_privilege('anon',format('public.%I',name),'UPDATE')
    or has_table_privilege('anon',format('public.%I',name),'DELETE')), 0::bigint,
  'anon has no core table CRUD');
select ok(has_table_privilege('authenticated','public.stores','SELECT')
  and has_table_privilege('authenticated','public.store_members','SELECT')
  and has_table_privilege('authenticated','public.store_subscriptions','SELECT'),
  'merchant can read three own-store core tables');
select ok(has_column_privilege('authenticated','public.stores','name','UPDATE')
  and has_column_privilege('authenticated','public.stores','timezone','UPDATE')
  and has_column_privilege('authenticated','public.stores','brand_config','UPDATE')
  and has_column_privilege('authenticated','public.stores','slug','UPDATE')
  and not has_column_privilege('authenticated','public.stores','plan','UPDATE')
  and not has_column_privilege('authenticated','public.stores','trial_ends_at','UPDATE'),
  'store settings UPDATE excludes entitlement columns');
select ok(not has_any_column_privilege('authenticated','public.stores','INSERT')
  and not has_table_privilege('authenticated','public.stores','DELETE')
  and not has_any_column_privilege('authenticated','public.store_members','INSERT')
  and not has_any_column_privilege('authenticated','public.store_members','UPDATE')
  and not has_table_privilege('authenticated','public.store_members','DELETE')
  and not has_any_column_privilege('authenticated','public.store_subscriptions','INSERT')
  and not has_any_column_privilege('authenticated','public.store_subscriptions','UPDATE')
  and not has_table_privilege('authenticated','public.store_subscriptions','DELETE'),
  'client cannot create stores, change membership, or change entitlements');
select ok(has_table_privilege('service_role','public.stores','INSERT')
  and has_table_privilege('service_role','public.store_members','INSERT')
  and has_table_privilege('service_role','public.store_subscriptions','INSERT'),
  'server provisioning retains core inserts');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::bigint from public.stores),1::bigint,'bound owner sees own store only');
select is((select count(*)::bigint from public.store_members),1::bigint,'membership self-policy has no recursion and is store scoped');
select is((select count(*)::bigint from public.store_subscriptions),1::bigint,'bound owner sees own entitlement only');
with changed as (update public.stores set name='A settings'
  where store_id='11111111-1111-4111-8111-111111111111' returning store_id)
select is((select count(*)::bigint from changed),1::bigint,'own settings update succeeds');
with changed as (update public.stores set name='B forbidden'
  where store_id='22222222-2222-4222-8222-222222222222' returning store_id)
select is((select count(*)::bigint from changed),0::bigint,'cross-store settings update denied');
select throws_ok($$update public.stores set plan='vip' where store_id='11111111-1111-4111-8111-111111111111'$$,
  '42501',null,'merchant cannot update plan');
select throws_ok($$update public.stores set trial_ends_at=now() where store_id='11111111-1111-4111-8111-111111111111'$$,
  '42501',null,'merchant cannot update trial');
select throws_ok($$insert into public.store_members(store_id,profile_id,role) values
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner')$$,
  '42501',null,'merchant cannot add owner membership');
select throws_ok($$update public.store_subscriptions set plan='vip' where store_id='11111111-1111-4111-8111-111111111111'$$,
  '42501',null,'merchant cannot upgrade subscription');
reset role;

update private.profile_auth_bindings set status='REVOKED',revoked_at=now()
  where auth_profile_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((select count(*)::bigint from public.stores),0::bigint,'revoked identity cannot read stores');
select is((select count(*)::bigint from public.store_members),0::bigint,'revoked identity cannot read membership');
select is((select count(*)::bigint from public.store_subscriptions),0::bigint,'revoked identity cannot read subscription');
reset role;

select * from finish();
rollback;
