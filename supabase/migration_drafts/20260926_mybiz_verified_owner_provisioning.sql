-- DRAFT ONLY. Production apply requires exact Owner approval and backup gate.
-- A server supplies p_actor_id only after auth.getUser(bearer) and payment checks.
begin;

do $$
begin
  if to_regprocedure('public.create_store_with_owner(text,text,text,text,text,text,text,text,text)') is null
    or to_regprocedure('public.generate_unique_store_slug(text)') is null
    or to_regclass('core.profiles') is null
    or to_regclass('private.profile_auth_bindings') is null then
    raise exception 'PROVISIONING_FOUNDATION_MISSING';
  end if;
end;
$$;

create or replace function public.create_store_with_verified_owner(
  p_actor_id uuid,
  p_store_name text,
  p_owner_name text,
  p_business_number text,
  p_phone text,
  p_email text,
  p_address text,
  p_business_type text,
  p_requested_slug text,
  p_plan text
)
returns table (store_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := gen_random_uuid();
  v_slug text;
  v_auth_email text;
  v_region text;
  v_customer_focus text;
  v_analytics_preset text;
begin
  select lower(trim(au.email)) into v_auth_email
  from auth.users au
  join core.profiles cp on cp.id = au.id and cp.is_active
  where au.id = p_actor_id;
  if v_auth_email is null or v_auth_email <> lower(trim(coalesce(p_email, ''))) then
    raise exception 'VERIFIED_OWNER_REQUIRED' using errcode = '42501';
  end if;
  -- This is the new exact-ID self-service path. Existing bound owners retain
  -- their verified profile binding and are never relinked by email.
  if exists (
    select 1 from private.profile_auth_bindings b
    where b.auth_profile_id = p_actor_id or b.public_profile_id = p_actor_id
  ) then
    raise exception 'BOUND_OWNER_REQUIRES_EXISTING_IDENTITY_PATH' using errcode = '42501';
  end if;
  if p_plan not in ('free', 'pro', 'vip') then
    raise exception 'INVALID_PLAN' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_store_name, '')), '') is null
    or nullif(trim(coalesce(p_owner_name, '')), '') is null
    or nullif(trim(coalesce(p_business_number, '')), '') is null
    or nullif(trim(coalesce(p_phone, '')), '') is null
    or nullif(trim(coalesce(p_address, '')), '') is null
    or nullif(trim(coalesce(p_business_type, '')), '') is null then
    raise exception 'PROVISION_FIELDS_REQUIRED' using errcode = '22023';
  end if;

  v_slug := public.generate_unique_store_slug(coalesce(nullif(trim(p_requested_slug), ''), p_store_name));
  v_region := split_part(trim(p_address), ' ', 1);
  if v_region = '' then v_region := '미설정'; end if;
  if p_business_type ilike '%카페%' or p_business_type ilike '%브런치%' or p_business_type ilike '%coffee%' then
    v_analytics_preset := 'seongsu_brunch_cafe';
    v_customer_focus := '직장인 점심·주말 방문';
  elsif p_business_type ilike '%고기%' or p_business_type ilike '%식당%' or p_business_type ilike '%외식%' or p_business_type ilike '%bbq%' then
    v_analytics_preset := 'mapo_evening_restaurant';
    v_customer_focus := '저녁 회식·예약 고객';
  else
    v_analytics_preset := 'consultation_service';
    v_customer_focus := '상담 전환 중심 고객';
  end if;

  insert into public.profiles (id, full_name, email, phone)
  values (p_actor_id, trim(p_owner_name), v_auth_email, nullif(trim(p_phone), ''))
  on conflict (id) do update set
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = timezone('utc', now());

  insert into public.stores (store_id, name, timezone, brand_config, slug, plan)
  values (
    v_store_id, trim(p_store_name), 'Asia/Seoul',
    jsonb_build_object(
      'owner_name', trim(p_owner_name), 'business_number', trim(p_business_number),
      'phone', trim(p_phone), 'email', v_auth_email,
      'address', trim(p_address), 'business_type', trim(p_business_type)
    ), v_slug, p_plan
  );
  insert into public.store_members (store_id, profile_id, role)
  values (v_store_id, p_actor_id, 'owner');
  insert into public.store_analytics_profiles
    (id, store_id, industry, region, customer_focus, analytics_preset, version, updated_at)
  values (gen_random_uuid(), v_store_id, trim(p_business_type), v_region,
    v_customer_focus, v_analytics_preset, 1, timezone('utc', now()));
  insert into public.store_priority_settings
    (id, store_id, revenue_weight, repeat_customer_weight, reservation_weight,
     consultation_weight, branding_weight, order_efficiency_weight, created_at, updated_at, version)
  values (gen_random_uuid(), v_store_id::text, 28, 18, 16, 14, 12, 12,
    timezone('utc', now()), timezone('utc', now()), 1);
  insert into public.store_home_content
    (id, store_id, hero_title, hero_subtitle, notice_text, contact_enabled,
     consultation_enabled, reservation_enabled, layout_mode, updated_at, version)
  values (gen_random_uuid(), v_store_id::text, trim(p_store_name),
    trim(p_business_type) || ' 운영을 시작할 준비가 되었습니다.',
    '기본 홈 콘텐츠가 자동으로 준비되었습니다.', true, true, true,
    'default', timezone('utc', now()), 1);

  return query select v_store_id, v_slug;
end;
$$;

revoke all on function public.create_store_with_verified_owner(
  uuid,text,text,text,text,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.create_store_with_verified_owner(
  uuid,text,text,text,text,text,text,text,text,text
) to service_role;

commit;
