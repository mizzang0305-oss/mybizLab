select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('stores', 'store_analytics_profiles', 'store_priority_settings', 'store_home_content')
order by table_name, ordinal_position;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_store_with_owner';

begin;

with created as (
  select (
    public.create_store_with_owner(
      p_store_name => 'MyBizLab Verification Store',
      p_owner_name => '홍길동',
      p_business_number => '123-45-67890',
      p_phone => '010-1234-5678',
      p_email => 'owner@example.com',
      p_address => '서울특별시 성동구 성수동1가 123-45',
      p_business_type => '카페',
      p_requested_slug => 'mybizlab-verification-store',
      p_owner_profile_id => '00000000-0000-0000-0000-000000000000'::uuid
    )
  ).*
),
checks as (
  select
    created.id as store_id,
    created.slug,
    exists(
      select 1
      from public.stores s
      where s.id = created.id
    ) as store_row_exists,
    exists(
      select 1
      from public.store_members sm
      where sm.store_id = created.id
        and sm.profile_id = '00000000-0000-0000-0000-000000000000'::uuid
        and sm.role = 'owner'
    ) as owner_membership_exists,
    exists(
      select 1
      from public.store_analytics_profiles sap
      where sap.store_id = created.id
    ) as analytics_profile_exists,
    exists(
      select 1
      from public.store_priority_settings sps
      where sps.store_id = created.id
    ) as priority_settings_exists,
    exists(
      select 1
      from public.store_home_content shc
      where shc.store_id = created.id
    ) as home_content_exists
  from created
)
select *
from checks;

rollback;

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'store_analytics_profiles';
