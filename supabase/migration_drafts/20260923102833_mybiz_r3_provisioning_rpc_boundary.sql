-- Draft only: exact Production approval is required before promotion or apply.
-- R3.2 restricted FREE provisioning boundary. Never run against a linked project in this phase.
begin;

do $guard$
begin
  if to_regclass('core.profiles') is null
    or to_regclass('private.profile_auth_bindings') is null
    or to_regclass('public.store_subscriptions') is null
    or to_regclass('public.store_analytics_profiles') is null
    or to_regclass('public.store_home_content') is null
    or to_regclass('public.store_priority_settings') is null
    or to_regclass('public.store_public_pages') is null then
    raise exception 'R3_PROVISIONING_BASELINE_MISSING';
  end if;
  if to_regclass('private.store_provisioning_receipts') is not null
    or to_regclass('private.store_provisioning_release_control') is not null
    or to_regprocedure('private.keep_provisioned_store_private()') is not null
    or to_regprocedure('public.provision_store_from_verified_actor(uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text)') is not null then
    raise exception 'R3_PROVISIONING_OBJECT_COLLISION';
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
  plan text not null check (plan = 'free'),
  payment_id text,
  store_id uuid unique references public.stores(store_id),
  created_at timestamptz not null default now(),
  primary key (actor_auth_user_id, request_key),
  check (payment_id is null)
);
create unique index store_provisioning_receipts_payment_id_unique
  on private.store_provisioning_receipts(payment_id) where payment_id is not null;
alter table private.store_provisioning_receipts enable row level security;
revoke all on private.store_provisioning_receipts from public, anon, authenticated, service_role;

-- The single private control row is HOLD by default. Only a separate,
-- approved operation may set a bounded synthetic CANARY. The RPC locks this
-- row before any actor, receipt or store lock so older deployed app versions
-- cannot bypass a server-only environment gate.
create table private.store_provisioning_release_control (
  singleton boolean primary key default true check (singleton),
  mode text not null check (mode in ('HOLD', 'CANARY')),
  actor_auth_user_id uuid references auth.users(id),
  request_key_sha256 text,
  payload_sha256 text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (mode = 'HOLD' and actor_auth_user_id is null and request_key_sha256 is null
      and payload_sha256 is null and expires_at is null)
    or
    (mode = 'CANARY' and actor_auth_user_id is not null
      and request_key_sha256 ~ '^[0-9a-f]{64}$'
      and payload_sha256 ~ '^[0-9a-f]{64}$' and expires_at is not null)
  )
);
insert into private.store_provisioning_release_control(singleton,mode) values (true,'HOLD');
alter table private.store_provisioning_release_control enable row level security;
revoke all on private.store_provisioning_release_control from public, anon, authenticated, service_role;

-- A member's existing public-page UPDATE policy must not publish a newly
-- provisioned canary. Existing stores without an R3 receipt are unchanged.
create function private.keep_provisioned_store_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $private_page$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from private.store_provisioning_receipts r where r.store_id = old.store_id) then
      raise exception 'PROVISIONED_STORE_PAGE_HOLD' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.store_id is distinct from new.store_id
    and exists (select 1 from private.store_provisioning_receipts r where r.store_id = old.store_id) then
    raise exception 'PROVISIONED_STORE_PAGE_HOLD' using errcode = '42501';
  end if;
  if new.is_published and exists (
    select 1 from private.store_provisioning_receipts r where r.store_id = new.store_id
  ) then
    raise exception 'PROVISIONED_STORE_PUBLICATION_HOLD' using errcode = '42501';
  end if;
  return new;
end;
$private_page$;
revoke all on function private.keep_provisioned_store_private() from public, anon, authenticated, service_role;
create trigger store_public_pages_provisioning_hold
before insert or update or delete on public.store_public_pages
for each row execute function private.keep_provisioned_store_private();

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
  v_identity_active boolean;
  v_active_bindings uuid[];
  v_binding_rows bigint;
  v_control private.store_provisioning_release_control%rowtype;
begin
  if p_auth_user_id is null
    or p_request_key is null or length(p_request_key) not between 1 and 128
    or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_plan is distinct from 'free'
    or nullif(trim(coalesce(p_store_name, '')), '') is null
    or nullif(trim(coalesce(p_owner_name, '')), '') is null
    or nullif(trim(coalesce(p_business_number, '')), '') is null
    or nullif(trim(coalesce(p_phone, '')), '') is null
    or nullif(trim(coalesce(p_email, '')), '') is null
    or nullif(trim(coalesce(p_address, '')), '') is null
    or nullif(trim(coalesce(p_business_type, '')), '') is null then
    raise exception 'INVALID_PROVISIONING_CONTEXT' using errcode = '22023';
  end if;
  if p_payment_id is not null or p_payment_amount is not null or p_payment_currency is not null then
    raise exception 'PAID_PROVISIONING_HOLD' using errcode = '42501';
  end if;
  -- First lock in every provisioning transaction. HOLD also prevents a
  -- previous Preview or server instance with old environment from writing.
  select c.* into v_control
  from private.store_provisioning_release_control c
  where c.singleton = true
  for update;
  if not found or v_control.mode <> 'CANARY'
    or v_control.expires_at <= pg_catalog.now()
    or v_control.actor_auth_user_id is distinct from p_auth_user_id
    or v_control.request_key_sha256 is distinct from
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_request_key, 'UTF8')), 'hex')
    or v_control.payload_sha256 is distinct from p_request_hash then
    raise exception 'PROVISIONING_HOLD' using errcode = '42501';
  end if;
  -- Lock before checking is_active. A revocation committed while this call
  -- waits for the actor lock must not be missed.
  select cp.is_active into v_identity_active
  from core.profiles cp
  join auth.users au on au.id = cp.id
  where cp.id = p_auth_user_id
  for update of cp;
  if v_identity_active is distinct from true then
    raise exception 'ACTIVE_AUTH_IDENTITY_REQUIRED' using errcode = '42501';
  end if;
  -- The actor lock also serializes different request keys from that actor.

  -- This narrow release only supports an existing ACTIVE EXACT_ID binding.
  -- Hold its row against revocation through commit, including receipt replay.
  select array_agg(bound.public_profile_id) filter (
      where bound.status = 'ACTIVE' and bound.revoked_at is null
        and bound.binding_source = 'EXACT_ID'
        and bound.public_profile_id = p_auth_user_id
    ), count(*)
  into v_active_bindings, v_binding_rows
  from (
    select b.public_profile_id, b.status, b.revoked_at, b.binding_source
    from private.profile_auth_bindings b
    where b.auth_profile_id = p_auth_user_id
    for share
  ) bound;
  if v_binding_rows <> 1 or coalesce(array_length(v_active_bindings, 1), 0) <> 1 then
    raise exception 'EXACT_ID_BINDING_REQUIRED' using errcode = '42501';
  end if;
  v_profile_id := v_active_bindings[1];

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

  if p_plan = 'free' and exists (
    select 1 from public.store_members sm
    join public.stores s on s.store_id = sm.store_id
    left join public.store_subscriptions ss on ss.store_id = sm.store_id
    where sm.profile_id = v_profile_id and sm.role = 'owner'
      and (s.plan = 'free' or ss.plan = 'free')
  ) then
    raise exception 'FREE_STORE_LIMIT_REACHED' using errcode = '42501';
  end if;

  -- The legacy slug helper checks before inserting. Two different actors can
  -- otherwise observe the same free slug before either INSERT. Production's
  -- unique slug index remains the final backstop; this lock serializes this
  -- RPC's allocation through commit. Identity locks scope receipt/quota replay.
  perform pg_catalog.pg_advisory_xact_lock(125768499, 1);
  v_store_id := pg_catalog.gen_random_uuid();
  v_slug := public.generate_unique_store_slug(
    coalesce(nullif(trim(p_requested_slug), ''), trim(p_store_name))
  );
  v_region := coalesce(nullif(pg_catalog.split_part(trim(p_address), ' ', 1), ''), '미설정');

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
  values (v_store_id, trim(p_business_type), v_region, '상담 전환 중심 고객', 'consultation_service');
  insert into public.store_priority_settings
    (store_id, revenue_weight, repeat_customer_weight, reservation_weight,
     consultation_weight, branding_weight, order_efficiency_weight)
  values (v_store_id::text, 28, 18, 16, 14, 12, 12);
  insert into public.store_home_content
    (store_id, hero_title, hero_subtitle, notice_text, contact_enabled,
     consultation_enabled, reservation_enabled, layout_mode)
  values (v_store_id::text, trim(p_store_name), trim(p_business_type) || ' 운영 준비 중',
    '기본 홈 콘텐츠가 준비되었습니다.', false, false, false, 'default');
  -- Establish the canonical nonpublic page in the same transaction as the
  -- store. Browser continuation may fill copy but may not publish it.
  insert into public.store_public_pages
    (id, store_id, page_title, hero_title, hero_subtitle,
     inquiry_enabled, reservation_enabled, waiting_enabled, is_published)
  values (v_store_id, v_store_id, trim(p_store_name), trim(p_store_name),
    '운영 준비 중', false, false, false, false);
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
