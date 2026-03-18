update public.stores
set slug = public.generate_unique_store_slug(name)
where coalesce(trim(slug), '') = '';

update public.stores
set plan = 'starter'
where coalesce(trim(plan), '') = '';

insert into public.store_analytics_profiles (
  id,
  store_id,
  industry,
  region,
  customer_focus,
  analytics_preset,
  version,
  updated_at
)
select
  gen_random_uuid(),
  s.store_id,
  coalesce(nullif(trim(s.business_type), ''), '미분류'),
  coalesce(nullif(split_part(trim(coalesce(s.address, '')), ' ', 1), ''), '미설정'),
  case
    when s.business_type ilike '%카페%' or s.business_type ilike '%브런치%' or s.business_type ilike '%coffee%'
      then '직장인 점심·주말 방문'
    when s.business_type ilike '%고기%' or s.business_type ilike '%식당%' or s.business_type ilike '%외식%' or s.business_type ilike '%bbq%'
      then '저녁 회식·예약 고객'
    else '상담 전환 중심 고객'
  end,
  case
    when s.business_type ilike '%카페%' or s.business_type ilike '%브런치%' or s.business_type ilike '%coffee%'
      then 'seongsu_brunch_cafe'
    when s.business_type ilike '%고기%' or s.business_type ilike '%식당%' or s.business_type ilike '%외식%' or s.business_type ilike '%bbq%'
      then 'mapo_evening_restaurant'
    else 'consultation_service'
  end,
  1,
  timezone('utc', now())
from public.stores s
left join public.store_analytics_profiles sap
  on sap.store_id = s.store_id
where sap.id is null;

insert into public.store_priority_settings (
  id,
  store_id,
  revenue_weight,
  repeat_customer_weight,
  reservation_weight,
  consultation_weight,
  branding_weight,
  order_efficiency_weight,
  created_at,
  updated_at,
  version
)
select
  gen_random_uuid(),
  s.store_id::text,
  28,
  18,
  16,
  14,
  12,
  12,
  timezone('utc', now()),
  timezone('utc', now()),
  1
from public.stores s
left join public.store_priority_settings sps
  on sps.store_id = s.store_id::text
where sps.id is null;

insert into public.store_home_content (
  id,
  store_id,
  hero_title,
  hero_subtitle,
  notice_text,
  contact_enabled,
  consultation_enabled,
  reservation_enabled,
  layout_mode,
  updated_at,
  version
)
select
  gen_random_uuid(),
  s.store_id::text,
  s.name,
  coalesce(nullif(trim(s.business_type), ''), '스토어') || ' 운영을 시작할 준비가 되었습니다.',
  '기본 홈 콘텐츠가 자동으로 채워졌습니다.',
  true,
  true,
  true,
  'default',
  timezone('utc', now()),
  1
from public.stores s
left join public.store_home_content shc
  on shc.store_id = s.store_id::text
where shc.id is null;

update public.store_members sm
set role = 'owner'
from public.stores s
join public.profiles p
  on lower(trim(p.email)) = lower(trim(s.email))
where sm.store_id = s.store_id
  and sm.profile_id = p.id
  and sm.role <> 'owner'
  and coalesce(trim(s.email), '') <> ''
  and 1 = (
    select count(*)
    from public.profiles p2
    where lower(trim(p2.email)) = lower(trim(s.email))
  );

insert into public.store_members (
  id,
  store_id,
  profile_id,
  role,
  created_at
)
select
  gen_random_uuid(),
  s.store_id,
  p.id,
  'owner',
  timezone('utc', now())
from public.stores s
join public.profiles p
  on lower(trim(p.email)) = lower(trim(s.email))
left join public.store_members sm
  on sm.store_id = s.store_id
 and sm.profile_id = p.id
left join public.store_members owner_sm
  on owner_sm.store_id = s.store_id
 and owner_sm.role = 'owner'
where sm.id is null
  and owner_sm.id is null
  and coalesce(trim(s.email), '') <> ''
  and 1 = (
    select count(*)
    from public.profiles p2
    where lower(trim(p2.email)) = lower(trim(s.email))
  );

select
  s.store_id,
  s.name,
  s.email,
  'OWNER_BACKFILL_UNRESOLVED' as issue
from public.stores s
left join public.store_members owner_sm
  on owner_sm.store_id = s.store_id
 and owner_sm.role = 'owner'
where owner_sm.id is null
order by s.name;
