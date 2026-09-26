-- Draft only: exact Production approval is required before promotion or apply.
-- MyBiz server-only provisioning boundary. Never run against a linked project in this phase.
begin;

do $guard$
begin
  if to_regclass('core.profiles') is null
    or to_regclass('private.profile_auth_bindings') is null
    or to_regclass('public.store_subscriptions') is null
    or to_regclass('public.store_analytics_profiles') is null
    or to_regclass('public.store_home_content') is null
    or to_regclass('public.store_priority_settings') is null then
    raise exception 'MYBIZ_PROVISIONING_BASELINE_MISSING';
  end if;
  if to_regclass('private.store_provisioning_receipts') is not null
    or to_regprocedure('public.provision_store_from_verified_actor(uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text)') is not null then
    raise exception 'MYBIZ_PROVISIONING_OBJECT_COLLISION';
  end if;
end;
$guard$;

-- Revoke every historical overload. No old function body or global membership
-- policy is changed; this is a separate, owner-gated Production operation.
do $revoke$
declare
  target regprocedure;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_store_with_owner'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', target);
  end loop;
end;
$revoke$;

create table private.store_provisioning_receipts (
  actor_auth_user_id uuid not null references auth.users(id),
  request_key text not null check (length(request_key) between 1 and 128),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  plan text not null check (plan in ('free', 'pro', 'vip')),
  payment_id text,
  store_id uuid unique references public.stores(store_id),
  created_at timestamptz not null default now(),
  primary key (actor_auth_user_id, request_key),
  check ((plan = 'free' and payment_id is null) or (plan <> 'free' and payment_id is not null))
);
create unique index store_provisioning_receipts_payment_id_unique
  on private.store_provisioning_receipts(payment_id) where payment_id is not null;
alter table private.store_provisioning_receipts enable row level security;
revoke all on private.store_provisioning_receipts from public, anon, authenticated, service_role;

-- This public-schema wrapper is exposed by PostgREST, but only service_role
-- receives EXECUTE. The actor argument is trustworthy only after the server
-- verifies a bearer token with Supabase Auth. SECURITY DEFINER is not itself
-- evidence of caller identity.
create function public.provision_store_from_verified_actor(
  p_auth_user_id uuid,
  p_request_key text,
  p_request_hash text,
  p_store_name text,
  p_owner_name text,
  p_business_number text,
  p_phone text,
  p_email text,
  p_address text,
  p_business_type text,
  p_requested_slug text,
  p_plan text,
  p_payment_id text,
  p_payment_amount numeric,
  p_payment_currency text
)
returns table (store_id uuid, slug text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_profile_id uuid;
  v_store_id uuid;
  v_slug text;
  v_existing private.store_provisioning_receipts%rowtype;
  v_region text;
  v_customer_focus text;
  v_analytics_preset text;
begin
  if p_auth_user_id is null
    or p_request_key is null or length(p_request_key) not between 1 and 128
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_plan not in ('free', 'pro', 'vip')
    or nullif(trim(coalesce(p_store_name, '')), '') is null
    or nullif(trim(coalesce(p_owner_name, '')), '') is null
    or nullif(trim(coalesce(p_business_number, '')), '') is null
    or nullif(trim(coalesce(p_phone, '')), '') is null
    or nullif(trim(coalesce(p_email, '')), '') is null
    or nullif(trim(coalesce(p_address, '')), '') is null
    or nullif(trim(coalesce(p_business_type, '')), '') is null then
    raise exception 'INVALID_PROVISIONING_CONTEXT' using errcode = '22023';
  end if;
  if (p_plan = 'free' and (p_payment_id is not null or p_payment_amount is not null))
    or (p_plan <> 'free' and
      (nullif(trim(coalesce(p_payment_id, '')), '') is null
        or p_payment_amount is null or p_payment_amount <= 0
        or p_payment_currency is distinct from 'KRW')) then
    raise exception 'PAYMENT_CONTEXT_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users au
    join core.profiles cp on cp.id = au.id and cp.is_active
    where au.id = p_auth_user_id
      and lower(au.email) = lower(trim(p_email))
  ) then
    raise exception 'ACTIVE_AUTH_IDENTITY_AND_EMAIL_REQUIRED' using errcode = '42501';
  end if;
  -- Serialize different request keys from the same actor as well as exact
  -- retries, so the free-store quota cannot race on separate receipts.
  perform 1 from core.profiles cp where cp.id = p_auth_user_id for update;

  -- The unique key serializes concurrent retries. A different body or reused
  -- paid receipt cannot be replayed as another store or entitlement.
  insert into private.store_provisioning_receipts
    (actor_auth_user_id, request_key, request_hash, plan, payment_id)
  values (p_auth_user_id, p_request_key, p_request_hash, p_plan, p_payment_id)
  on conflict do nothing;
  select r.* into v_existing
  from private.store_provisioning_receipts r
  where r.actor_auth_user_id = p_auth_user_id and r.request_key = p_request_key
  for update;
  if not found then
    raise exception 'PAYMENT_RECEIPT_REUSED' using errcode = '23505';
  end if;
  if v_existing.request_hash <> p_request_hash
    or v_existing.plan <> p_plan
    or v_existing.payment_id is distinct from p_payment_id then
    raise exception 'PROVISIONING_IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;
  if v_existing.store_id is not null then
    return query select s.store_id, s.slug, true
    from public.stores s where s.store_id = v_existing.store_id;
    return;
  end if;

  -- Existing active binding wins. Revoked or otherwise historical bindings
  -- block exact-ID fallback; a legacy public profile is never guessed.
  select b.public_profile_id into v_profile_id
  from private.profile_auth_bindings b
  where b.auth_profile_id = p_auth_user_id
    and b.status = 'ACTIVE' and b.revoked_at is null;
  if v_profile_id is null then
    if exists (
      select 1 from private.profile_auth_bindings b
      where b.auth_profile_id = p_auth_user_id or b.public_profile_id = p_auth_user_id
    ) then
      raise exception 'IDENTITY_BINDING_NOT_ACTIVE' using errcode = '42501';
    end if;
    v_profile_id := p_auth_user_id;
    insert into public.profiles (id, full_name, email, phone)
    values (v_profile_id, trim(p_owner_name), lower(trim(p_email)), trim(p_phone))
    on conflict (id) do nothing;
  end if;

  if p_plan = 'free' and exists (
    select 1 from public.store_members sm
    join public.store_subscriptions ss on ss.store_id = sm.store_id
    where sm.profile_id = v_profile_id and sm.role = 'owner' and ss.plan = 'free'
  ) then
    raise exception 'FREE_STORE_LIMIT_REACHED' using errcode = '42501';
  end if;

  v_store_id := pg_catalog.gen_random_uuid();
  v_slug := public.generate_unique_store_slug(
    coalesce(nullif(trim(p_requested_slug), ''), trim(p_store_name))
  );
  v_region := coalesce(nullif(pg_catalog.split_part(trim(p_address), ' ', 1), ''), '미설정');
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

  insert into public.stores (store_id, name, slug, plan, brand_config)
  values (
    v_store_id, trim(p_store_name), v_slug, p_plan,
    pg_catalog.jsonb_build_object(
      'owner_name', trim(p_owner_name), 'business_number', trim(p_business_number),
      'phone', trim(p_phone), 'email', lower(trim(p_email)),
      'address', trim(p_address), 'business_type', trim(p_business_type)
    )
  );
  insert into public.store_members (store_id, profile_id, role)
  values (v_store_id, v_profile_id, 'owner');
  insert into public.store_subscriptions
    (store_id, plan, status, billing_provider, current_period_starts_at, current_period_ends_at)
  values (
    v_store_id, p_plan, 'active',
    case when p_plan = 'free' then 'manual' else 'portone' end,
    pg_catalog.now(), pg_catalog.now() + interval '30 days'
  );
  insert into public.store_analytics_profiles
    (store_id, industry, region, customer_focus, analytics_preset)
  values (v_store_id, trim(p_business_type), v_region, v_customer_focus, v_analytics_preset);
  insert into public.store_priority_settings
    (store_id, revenue_weight, repeat_customer_weight, reservation_weight,
     consultation_weight, branding_weight, order_efficiency_weight)
  values (v_store_id::text, 28, 18, 16, 14, 12, 12);
  insert into public.store_home_content
    (store_id, hero_title, hero_subtitle, notice_text, contact_enabled,
     consultation_enabled, reservation_enabled, layout_mode)
  values (v_store_id::text, trim(p_store_name), trim(p_business_type) || ' 운영 준비 중',
    '기본 홈 콘텐츠가 준비되었습니다.', true, true, true, 'default');
  update private.store_provisioning_receipts r
  set store_id = v_store_id
  where r.actor_auth_user_id = p_auth_user_id and r.request_key = p_request_key;

  return query select v_store_id, v_slug, false;
end;
$body$;

revoke all on function public.provision_store_from_verified_actor(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text
) from public, anon, authenticated;
grant execute on function public.provision_store_from_verified_actor(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text
) to service_role;

commit;
