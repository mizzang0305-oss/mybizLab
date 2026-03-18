do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'store_id'
  ) then
    raise exception 'public.stores.store_id not found. This live patch expects the live database primary key column to be store_id.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_priority_settings'
      and column_name = 'revenue_weight'
  ) then
    raise exception 'public.store_priority_settings explicit weight columns are required for this live patch.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_home_content'
      and column_name = 'notice_text'
  ) then
    raise exception 'public.store_home_content live columns do not match the expected structure.';
  end if;

  if to_regprocedure('public.generate_unique_store_slug(text)') is null then
    raise exception 'public.generate_unique_store_slug(text) must exist before replacing create_store_with_owner.';
  end if;

  if to_regprocedure('public.is_store_member(uuid)') is null then
    raise exception 'public.is_store_member(uuid) must exist before replacing create_store_with_owner.';
  end if;
end;
$$;

drop function if exists public.create_store_with_owner(text, text, text, text, text, text, text, text);
drop function if exists public.create_store_with_owner(text, text, text, text, text, text, text, text, text);
drop function if exists public.create_store_with_owner(text, text, text, text, text, text, text, text, uuid);

create or replace function public.create_store_with_owner(
  p_store_name text,
  p_owner_name text,
  p_business_number text,
  p_phone text,
  p_email text,
  p_address text,
  p_business_type text,
  p_requested_slug text default null,
  p_plan text default 'starter'
)
returns table (store_id uuid, slug text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_store_id uuid := gen_random_uuid();
  v_slug text;
  v_profile_email text;
  v_profile_name text;
  v_region text;
  v_customer_focus text;
  v_analytics_preset text;
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'starter');
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED'
      using errcode = '42501', hint = 'create_store_with_owner requires an authenticated user.';
  end if;

  if nullif(trim(coalesce(p_store_name, '')), '') is null then
    raise exception 'STORE_NAME_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_owner_name, '')), '') is null then
    raise exception 'OWNER_NAME_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_business_number, '')), '') is null then
    raise exception 'BUSINESS_NUMBER_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'PHONE_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'EMAIL_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_address, '')), '') is null then
    raise exception 'ADDRESS_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_business_type, '')), '') is null then
    raise exception 'BUSINESS_TYPE_REQUIRED' using errcode = '22023';
  end if;

  v_profile_email := lower(trim(coalesce(nullif(auth.jwt() ->> 'email', ''), p_email)));
  v_profile_name := trim(coalesce(nullif(p_owner_name, ''), split_part(v_profile_email, '@', 1)));
  v_slug := public.generate_unique_store_slug(coalesce(nullif(trim(p_requested_slug), ''), p_store_name));
  v_region := split_part(trim(coalesce(p_address, '')), ' ', 1);

  if v_region = '' then
    v_region := '미설정';
  end if;

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
  values (v_actor_id, v_profile_name, v_profile_email, nullif(trim(p_phone), ''))
  on conflict (id) do update
  set
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = timezone('utc', now());

  insert into public.stores (
    store_id,
    name,
    slug,
    owner_name,
    business_number,
    phone,
    email,
    address,
    business_type,
    plan
  )
  values (
    v_store_id,
    trim(p_store_name),
    v_slug,
    trim(p_owner_name),
    trim(p_business_number),
    trim(p_phone),
    lower(trim(p_email)),
    trim(p_address),
    trim(p_business_type),
    v_plan
  );

  insert into public.store_members (store_id, profile_id, role)
  values (v_store_id, v_actor_id, 'owner')
  on conflict do nothing;

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
    v_store_id,
    trim(p_business_type),
    v_region,
    v_customer_focus,
    v_analytics_preset,
    1,
    timezone('utc', now())
  where not exists (
    select 1
    from public.store_analytics_profiles sap
    where sap.store_id = v_store_id
  );

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
    v_store_id::text,
    28,
    18,
    16,
    14,
    12,
    12,
    timezone('utc', now()),
    timezone('utc', now()),
    1
  where not exists (
    select 1
    from public.store_priority_settings sps
    where sps.store_id = v_store_id::text
  );

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
    v_store_id::text,
    trim(p_store_name),
    trim(p_business_type) || ' 운영을 시작할 준비가 되었습니다.',
    '기본 홈 콘텐츠가 자동으로 준비되었습니다.',
    true,
    true,
    true,
    'default',
    timezone('utc', now()),
    1
  where not exists (
    select 1
    from public.store_home_content shc
    where shc.store_id = v_store_id::text
  );

  return query
  select v_store_id, v_slug;
end;
$$;

revoke all on function public.create_store_with_owner(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_store_with_owner(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_store_with_owner(text, text, text, text, text, text, text, text, text) to service_role;
