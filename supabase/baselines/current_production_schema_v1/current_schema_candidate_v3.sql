--
-- PostgreSQL database dump
--

\restrict MYBIZBASELINE20260928V1

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: biz2lab; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA biz2lab;


--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: membership_role; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.membership_role AS ENUM (
    'owner',
    'admin',
    'member'
);


--
-- Name: membership_status; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.membership_status AS ENUM (
    'active',
    'invited',
    'suspended'
);


--
-- Name: create_organization_with_owner(text, text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.create_organization_with_owner(p_name text, p_slug text DEFAULT NULL::text) RETURNS TABLE(id uuid, slug text, name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'core', 'public'
    AS $$
declare
  v_user_id uuid;
  v_name text;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 0;
  v_organization_id uuid;
  v_organization_slug text;
  v_organization_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTHENTICATED_USER_REQUIRED';
  end if;

  v_name := trim(coalesce(p_name, ''));

  if v_name = '' then
    raise exception 'ORGANIZATION_NAME_REQUIRED';
  end if;

  if not exists (
    select 1
    from core.profiles p
    where p.id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'PROFILE_NOT_READY';
  end if;

  v_base_slug := lower(trim(coalesce(p_slug, '')));

  if v_base_slug = '' then
    v_base_slug := lower(v_name);
  end if;

  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  if v_base_slug = '' then
    v_base_slug :=
      'org-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
  end if;

  v_slug := v_base_slug;

  loop
    begin
      insert into core.organizations (name, slug)
      values (v_name, v_slug)
      returning organizations.id, organizations.slug, organizations.name
      into v_organization_id, v_organization_slug, v_organization_name;

      exit;
    exception
      when unique_violation then
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix::text;
    end;
  end loop;

  insert into core.memberships (
    organization_id,
    profile_id,
    role,
    status
  )
  values (
    v_organization_id,
    v_user_id,
    'owner',
    'active'
  )
  on conflict (organization_id, profile_id) do update
    set role = 'owner',
        status = 'active',
        updated_at = timezone('utc', now());

  update core.profiles
  set default_organization_id = v_organization_id,
      updated_at = timezone('utc', now())
  where profiles.id = v_user_id;

  id := v_organization_id;
  slug := v_organization_slug;
  name := v_organization_name;

  return next;
end;
$$;


--
-- Name: handle_auth_user_created(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.handle_auth_user_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'core', 'public'
    AS $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '사용자'
  );

  insert into core.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    v_full_name
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(core.profiles.full_name, excluded.full_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;


--
-- Name: has_org_access(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.has_org_access(target_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'core', 'public'
    AS $$
  select exists (
    select 1
    from core.memberships m
    where m.organization_id = target_org_id
      and m.profile_id = auth.uid()
      and m.status = 'active'::core.membership_status
  );
$$;


--
-- Name: has_org_role(uuid, core.membership_role[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.has_org_role(target_org_id uuid, allowed_roles core.membership_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'core', 'public'
    AS $$
  select exists (
    select 1
    from core.memberships m
    where m.organization_id = target_org_id
      and m.profile_id = auth.uid()
      and m.status = 'active'::core.membership_status
      and m.role = any(allowed_roles)
  );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: consume_job_confirmation_link(text, text, text, jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.consume_job_confirmation_link(p_token_hash text, p_outcome text, p_actor_label text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_link public.job_confirmation_links%rowtype;
  v_confirmation_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_outcome not in ('confirmed', 'correction_requested') then
    raise exception 'INVALID_CONFIRMATION_INPUT' using errcode = '22023';
  end if;

  select * into v_link
  from public.job_confirmation_links l
  where l.token_hash = p_token_hash
  for update;

  if not found
    or v_link.revoked_at is not null
    or v_link.consumed_at is not null
    or v_link.expires_at <= timezone('utc', now())
    or not exists (
      select 1 from public.service_jobs j
      where j.id = v_link.job_id and j.store_id = v_link.store_id and j.evidence_revision = v_link.evidence_revision
    )
  then
    raise exception 'CONFIRMATION_LINK_INVALID' using errcode = '22023';
  end if;

  insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome, actor_label, metadata)
  values (v_link.store_id, v_link.job_id, v_link.evidence_revision, p_outcome, p_actor_label, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_confirmation_id;

  update public.job_confirmation_links set consumed_at = timezone('utc', now()) where id = v_link.id;
  update public.service_jobs
  set state = case when p_outcome = 'confirmed' then 'CUSTOMER_CONFIRMED' else 'CUSTOMER_CORRECTION_REQUESTED' end,
      updated_at = timezone('utc', now())
  where id = v_link.job_id;

  return v_confirmation_id;
end;
$_$;


--
-- Name: create_next_job_evidence_revision(uuid, uuid, text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.create_next_job_evidence_revision(p_job_id uuid, p_actor_id uuid, p_reason text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_store_id uuid;
  v_current_revision integer;
  v_next_revision integer;
  v_had_confirmation boolean;
begin
  select j.store_id, j.evidence_revision into v_store_id, v_current_revision
  from public.service_jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'SERVICE_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_id is null or not exists (
    select 1 from public.store_members sm
    where sm.store_id = v_store_id and sm.profile_id = p_actor_id
  ) then
    raise exception 'SERVICE_JOB_MEMBER_REQUIRED' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.job_confirmations c
    where c.job_id = p_job_id and c.evidence_revision = v_current_revision and c.outcome = 'confirmed'
  ) into v_had_confirmation;

  v_next_revision := v_current_revision + 1;
  insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by, reason)
  values (v_store_id, p_job_id, v_next_revision, p_actor_id, nullif(btrim(p_reason), ''));

  update public.service_jobs
  set evidence_revision = v_next_revision,
      state = case when v_had_confirmation then 'CONFIRMATION_OUTDATED' else 'WORK_COMPLETED' end,
      updated_at = timezone('utc', now())
  where id = p_job_id;

  return v_next_revision;
end;
$$;


--
-- Name: current_service_os_business_profile_id(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.current_service_os_business_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with current_identity as (
    select auth.uid() as id
  ),
  explicit_binding as (
    select b.public_profile_id
    from private.profile_auth_bindings b
    join current_identity ci on ci.id = b.auth_profile_id
    join core.profiles cp on cp.id = b.auth_profile_id and cp.is_active
    where b.status = 'ACTIVE'
      and b.revoked_at is null
    limit 1
  ),
  exact_id_fallback as (
    select ci.id as public_profile_id
    from current_identity ci
    join auth.users au on au.id = ci.id
    join core.profiles cp on cp.id = ci.id and cp.is_active
    join public.profiles pp on pp.id = ci.id
    where not exists (
      select 1
      from private.profile_auth_bindings b
      where b.auth_profile_id = ci.id or b.public_profile_id = ci.id
    )
  )
  select coalesce(
    (select eb.public_profile_id from explicit_binding eb),
    (select ef.public_profile_id from exact_id_fallback ef)
  );
$$;


--
-- Name: enforce_content_candidate_terminal_state(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.enforce_content_candidate_terminal_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.status in ('APPROVED', 'PUBLISH_READY', 'PUBLISHED')
    and not private.is_service_os_publication_eligible(new.store_id, new.job_id, new.evidence_revision, new.channel, new.merchant_approved_at)
  then
    raise exception 'CONTENT_PUBLICATION_NOT_ELIGIBLE' using errcode = '23514';
  end if;
  if new.status = 'PUBLISHED' and (new.provider_receipt is null or new.provider_receipt = '{}'::jsonb) then
    raise exception 'CONTENT_PROVIDER_RECEIPT_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;


--
-- Name: enforce_portfolio_publication_eligibility(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.enforce_portfolio_publication_eligibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_candidate public.content_candidates%rowtype;
begin
  if new.status not in ('approved', 'published') then
    return new;
  end if;
  if new.content_candidate_id is null then
    raise exception 'PORTFOLIO_CONTENT_CANDIDATE_REQUIRED' using errcode = '23514';
  end if;
  select * into v_candidate from public.content_candidates cc
  where cc.id = new.content_candidate_id
    and cc.store_id = new.store_id
    and cc.job_id = new.job_id
    and cc.evidence_revision = new.evidence_revision;
  if not found
    or v_candidate.status not in ('APPROVED', 'PUBLISH_READY', 'PUBLISHED')
    or not private.is_service_os_publication_eligible(v_candidate.store_id, v_candidate.job_id, v_candidate.evidence_revision, v_candidate.channel, v_candidate.merchant_approved_at)
    or (new.status = 'published' and (v_candidate.status <> 'PUBLISHED' or new.published_at is null))
  then
    raise exception 'PORTFOLIO_PUBLICATION_NOT_ELIGIBLE' using errcode = '23514';
  end if;
  return new;
end;
$$;


--
-- Name: initialize_job_evidence_revision(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.initialize_job_evidence_revision() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by, reason)
  values (new.store_id, new.id, new.evidence_revision, new.created_by, 'job_created');
  return new;
end;
$$;


--
-- Name: is_service_os_publication_eligible(uuid, uuid, integer, text, timestamp with time zone); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_service_os_publication_eligible(p_store_id uuid, p_job_id uuid, p_revision integer, p_channel text, p_merchant_approved_at timestamp with time zone) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select p_merchant_approved_at is not null
    and exists (
      select 1
      from public.service_jobs j
      where j.id = p_job_id
        and j.store_id = p_store_id
        and j.evidence_revision = p_revision
        and j.vertical <> 'medical'
    )
    and exists (
      select 1
      from public.job_confirmations c
      where c.job_id = p_job_id
        and c.store_id = p_store_id
        and c.evidence_revision = p_revision
        and c.outcome = 'confirmed'
    )
    and exists (
      select 1
      from public.consent_records cr
      where cr.job_id = p_job_id
        and cr.store_id = p_store_id
        and cr.evidence_revision = p_revision
        and cr.withdrawn_at is null
        and p_channel = any(cr.channels)
        and (
          (p_channel = 'website' and cr.purpose = 'website')
          or (p_channel = 'blog' and cr.purpose = 'blog')
          or (p_channel in ('instagram', 'tiktok', 'youtube_shorts') and cr.purpose = 'social')
        )
    );
$$;


--
-- Name: is_service_os_store_member(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_service_os_store_member(target_store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.store_members sm
      where sm.store_id = target_store_id
        and sm.profile_id = private.current_service_os_business_profile_id()
    );
$$;


--
-- Name: biz2lab_commercial_delete_submission(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.biz2lab_commercial_delete_submission(p_id bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with deleted as (
    delete from biz2lab.commercial_submissions
    where id = p_id
    returning 1
  )
  select exists(select 1 from deleted);
$$;


--
-- Name: biz2lab_commercial_expired_ids(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.biz2lab_commercial_expired_ids(p_cutoff timestamp with time zone) RETURNS TABLE(id bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id
  from biz2lab.commercial_submissions s
  where s.created_at < p_cutoff
  order by s.id;
$$;


--
-- Name: biz2lab_commercial_insert_submission(text, text, text, text, text, text, text, text, text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.biz2lab_commercial_insert_submission(p_kind text, p_service text, p_email text, p_name text, p_message text, p_source text, p_landing_url text, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_consented_at timestamp with time zone, p_created_at timestamp with time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id bigint;
begin
  insert into biz2lab.commercial_submissions (
    kind, service, email, name, message, source, landing_url,
    utm_source, utm_medium, utm_campaign, consented_at, created_at
  )
  values (
    p_kind, p_service, lower(p_email), p_name, p_message, p_source, p_landing_url,
    p_utm_source, p_utm_medium, p_utm_campaign, p_consented_at, p_created_at
  )
  returning id into v_id;
  return v_id;
end;
$$;


--
-- Name: biz2lab_commercial_recent_submission_exists(text, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.biz2lab_commercial_recent_submission_exists(p_service text, p_kind text, p_email text, p_cutoff timestamp with time zone) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from biz2lab.commercial_submissions s
    where s.service = p_service
      and s.kind = p_kind
      and s.email = lower(p_email)
      and s.created_at >= p_cutoff
  );
$$;


--
-- Name: biz2lab_commercial_rows_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.biz2lab_commercial_rows_by_email(p_email text) RETURNS TABLE(id bigint, kind text, service text, email text, name text, message text, source text, landing_url text, utm_source text, utm_medium text, utm_campaign text, consented_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    s.id, s.kind, s.service, s.email, s.name, s.message, s.source,
    s.landing_url, s.utm_source, s.utm_medium, s.utm_campaign,
    s.consented_at, s.created_at
  from biz2lab.commercial_submissions s
  where s.email = lower(p_email)
  order by s.id;
$$;


--
-- Name: create_store_with_owner(text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_store_with_owner(p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text DEFAULT NULL::text, p_plan text DEFAULT 'starter'::text) RETURNS TABLE(store_id uuid, slug text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
    timezone,
    brand_config,
    slug,
    plan
  )
  values (
    v_store_id,
    trim(p_store_name),
    'Asia/Seoul',
    jsonb_build_object(
      'owner_name', trim(p_owner_name),
      'business_number', trim(coalesce(p_business_number, '')),
      'phone', trim(p_phone),
      'email', lower(trim(p_email)),
      'address', trim(p_address),
      'business_type', trim(p_business_type)
    ),
    v_slug,
    v_plan
  );

  insert into public.store_members (store_id, profile_id, role)
  values (v_store_id, v_actor_id, 'owner')
  on conflict (store_id, profile_id) do nothing;

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


--
-- Name: generate_unique_store_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_store_slug(base_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  base_slug text;
  candidate text;
  suffix_num int := 1;
begin
  base_slug := lower(coalesce(base_name, 'store'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  if base_slug = '' then
    base_slug := 'store';
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from public.stores s
    where s.slug = candidate
  ) loop
    suffix_num := suffix_num + 1;
    candidate := base_slug || '-' || suffix_num::text;
  end loop;

  return candidate;
end;
$$;


--
-- Name: get_cohort_stats(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cohort_stats(cohort_key_input text) RETURNS TABLE(avg_score numeric, p80_score numeric, sample_size bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    avg(score::numeric) as avg_score,
    percentile_cont(0.8) within group (order by score::numeric) as p80_score,
    count(*) as sample_size
  from public.diagnosis_runs
  where cohort_key = cohort_key_input;
$$;


--
-- Name: is_store_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_store_member(target_store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select private.is_service_os_store_member(target_store_id);
$$;


--
-- Name: provision_store_from_verified_actor(uuid, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.provision_store_from_verified_actor(p_auth_user_id uuid, p_request_key text, p_request_hash text, p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text, p_plan text, p_payment_id text, p_payment_amount numeric, p_payment_currency text) RETURNS TABLE(store_id uuid, slug text, replayed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: slugify_store_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify_store_name(input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  result text;
begin
  result := lower(coalesce(input, 'store'));
  result := regexp_replace(result, '[^a-z0-9가-힣\s-]', '', 'g');
  result := regexp_replace(result, '\s+', '-', 'g');
  result := regexp_replace(result, '-{2,}', '-', 'g');
  result := trim(both '-' from result);

  if result = '' then
    result := 'store';
  end if;

  return result;
end;
$$;


--
-- Name: update_store_oauth_credentials_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_oauth_credentials_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: commercial_submissions; Type: TABLE; Schema: biz2lab; Owner: -
--

CREATE TABLE biz2lab.commercial_submissions (
    id bigint NOT NULL,
    kind text NOT NULL,
    service text NOT NULL,
    email text NOT NULL,
    name text,
    message text,
    source text NOT NULL,
    landing_url text NOT NULL,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    consented_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commercial_submissions_check CHECK ((((kind = 'inquiry'::text) AND (name IS NOT NULL) AND (message IS NOT NULL)) OR ((kind = 'email_lead'::text) AND (name IS NULL) AND (message IS NULL)))),
    CONSTRAINT commercial_submissions_kind_check CHECK ((kind = ANY (ARRAY['inquiry'::text, 'email_lead'::text]))),
    CONSTRAINT commercial_submissions_service_check CHECK ((service = ANY (ARRAY['mybiz'::text, 'web'::text, 'minz-mind'::text])))
);


--
-- Name: commercial_submissions_id_seq; Type: SEQUENCE; Schema: biz2lab; Owner: -
--

ALTER TABLE biz2lab.commercial_submissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME biz2lab.commercial_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: memberships; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role core.membership_role DEFAULT 'member'::core.membership_role NOT NULL,
    status core.membership_status DEFAULT 'active'::core.membership_status NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT organizations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    default_organization_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: profile_auth_bindings; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.profile_auth_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_profile_id uuid NOT NULL,
    auth_profile_id uuid NOT NULL,
    binding_source text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    verified_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT profile_auth_bindings_binding_source_check CHECK ((binding_source = ANY (ARRAY['EXACT_ID'::text, 'OWNER_VERIFIED'::text, 'MIGRATION_VERIFIED'::text, 'ADMIN_VERIFIED'::text]))),
    CONSTRAINT profile_auth_bindings_exact_id_check CHECK (((binding_source <> 'EXACT_ID'::text) OR (public_profile_id = auth_profile_id))),
    CONSTRAINT profile_auth_bindings_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT profile_auth_bindings_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'REVOKED'::text]))),
    CONSTRAINT profile_auth_bindings_status_time_check CHECK ((((status = 'ACTIVE'::text) AND (revoked_at IS NULL)) OR ((status = 'REVOKED'::text) AND (revoked_at IS NOT NULL))))
);

ALTER TABLE ONLY private.profile_auth_bindings FORCE ROW LEVEL SECURITY;


--
-- Name: store_provisioning_receipts; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.store_provisioning_receipts (
    actor_auth_user_id uuid NOT NULL,
    request_key text NOT NULL,
    request_hash text NOT NULL,
    plan text NOT NULL,
    payment_id text,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT store_provisioning_receipts_check CHECK ((((plan = 'free'::text) AND (payment_id IS NULL)) OR ((plan <> 'free'::text) AND (payment_id IS NOT NULL)))),
    CONSTRAINT store_provisioning_receipts_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text]))),
    CONSTRAINT store_provisioning_receipts_request_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT store_provisioning_receipts_request_key_check CHECK (((length(request_key) >= 1) AND (length(request_key) <= 128)))
);


--
-- Name: ai_briefing_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_briefing_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    snapshot_id text,
    action_title text,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    period_type text,
    period_start date,
    period_end date,
    operations_score numeric,
    top_bottlenecks jsonb,
    recommended_actions jsonb,
    expected_impact jsonb,
    summary text,
    created_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1
);


--
-- Name: brand_site_portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_site_portfolio_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    brand_site_id uuid NOT NULL,
    job_id uuid NOT NULL,
    evidence_revision integer NOT NULL,
    content_candidate_id uuid,
    title text NOT NULL,
    summary text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT brand_site_portfolio_items_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT brand_site_portfolio_items_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'withdrawn'::text])))
);

ALTER TABLE ONLY public.brand_site_portfolio_items FORCE ROW LEVEL SECURITY;


--
-- Name: brand_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    slug text NOT NULL,
    tier text DEFAULT 'basic'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    theme jsonb DEFAULT '{}'::jsonb NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    custom_domain text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT brand_sites_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT brand_sites_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'preview'::text, 'published'::text, 'suspended'::text]))),
    CONSTRAINT brand_sites_tier_check CHECK ((tier = ANY (ARRAY['basic'::text, 'brand'::text, 'growth'::text])))
);

ALTER TABLE ONLY public.brand_sites FORCE ROW LEVEL SECURITY;


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    evidence_revision integer NOT NULL,
    purpose text NOT NULL,
    text_version text NOT NULL,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    actor text NOT NULL,
    source text NOT NULL,
    granted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    withdrawn_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT consent_records_actor_check CHECK ((actor = ANY (ARRAY['customer'::text, 'guardian'::text]))),
    CONSTRAINT consent_records_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT consent_records_purpose_check CHECK ((purpose = ANY (ARRAY['privacy'::text, 'marketing'::text, 'website'::text, 'blog'::text, 'social'::text, 'medical_advertising'::text]))),
    CONSTRAINT consent_records_source_check CHECK ((source = ANY (ARRAY['secure_link'::text, 'paper_record'::text, 'staff_recorded'::text])))
);

ALTER TABLE ONLY public.consent_records FORCE ROW LEVEL SECURITY;


--
-- Name: content_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    evidence_revision integer NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    draft_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    merchant_approved_at timestamp with time zone,
    provider_receipt jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT content_candidates_channel_check CHECK ((channel = ANY (ARRAY['website'::text, 'blog'::text, 'instagram'::text, 'tiktok'::text, 'youtube_shorts'::text]))),
    CONSTRAINT content_candidates_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT content_candidates_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'GENERATED'::text, 'REVIEW_REQUIRED'::text, 'APPROVED'::text, 'PUBLISH_READY'::text, 'PUBLISHED'::text, 'FAILED'::text])))
);

ALTER TABLE ONLY public.content_candidates FORCE ROW LEVEL SECURITY;


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    message_meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'staff'::text, 'system'::text])))
);


--
-- Name: conversation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    inquiry_id uuid,
    customer_id uuid,
    visitor_session_id uuid,
    channel text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    CONSTRAINT conversation_sessions_channel_check CHECK ((channel = ANY (ARRAY['public_ai_chat'::text, 'owner_assistant'::text, 'support'::text, 'other'::text]))),
    CONSTRAINT conversation_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: customer_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    contact_type text NOT NULL,
    normalized_value text NOT NULL,
    raw_value text,
    is_primary boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid,
    CONSTRAINT customer_contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['phone'::text, 'email'::text, 'kakao'::text, 'instagram'::text, 'other'::text])))
);


--
-- Name: customer_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    favorite_menus jsonb DEFAULT '[]'::jsonb NOT NULL,
    disliked_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    allergy_notes text,
    seating_preferences text,
    visit_time_preferences text,
    marketing_consent boolean DEFAULT false NOT NULL,
    memory_summary text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_recommendation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_recommendation_actions (
    action_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    recommendation_key text NOT NULL,
    recommendation_type text NOT NULL,
    status text DEFAULT 'suggested'::text NOT NULL,
    note text,
    acted_by uuid,
    acted_at timestamp with time zone,
    snoozed_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_recommendation_actions_recommendation_type_check CHECK ((recommendation_type = ANY (ARRAY['reorder'::text, 'upsell'::text, 'revisit'::text, 'review_request'::text, 'reservation_followup'::text, 'waiting_followup'::text, 'content_conversion'::text]))),
    CONSTRAINT customer_recommendation_actions_status_check CHECK ((status = ANY (ARRAY['suggested'::text, 'dismissed'::text, 'completed'::text, 'snoozed'::text])))
);


--
-- Name: customer_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text,
    summary text,
    occurred_at timestamp with time zone
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    customer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_key text NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    quiet_mode boolean DEFAULT false NOT NULL,
    quiet_until timestamp with time zone,
    marketing_consent boolean,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    name text,
    normalized_phone text,
    normalized_email text,
    visit_count integer DEFAULT 0 NOT NULL,
    is_regular boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: diagnosis_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosis_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    input_json jsonb NOT NULL,
    report_json jsonb NOT NULL,
    score integer NOT NULL,
    bottleneck text,
    title text DEFAULT '외식업 3분 진단'::text NOT NULL,
    cohort_key text,
    version text DEFAULT 'v1'::text NOT NULL,
    request_id text,
    run_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    result jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT diagnosis_runs_score_range CHECK (((score >= 0) AND (score <= 100)))
);

ALTER TABLE ONLY public.diagnosis_runs FORCE ROW LEVEL SECURITY;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    table_id uuid,
    session_id uuid,
    customer_id uuid,
    actor text NOT NULL,
    type text NOT NULL,
    entity_type text,
    entity_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    dedupe_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    visitor_session_id uuid,
    conversation_session_id uuid,
    channel text DEFAULT 'public_page'::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    subject text,
    summary text,
    intent text,
    priority_score integer,
    contact_name text,
    contact_phone text,
    contact_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text,
    message text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    memo text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    requested_visit_date date,
    source text,
    CONSTRAINT inquiries_channel_check CHECK ((channel = ANY (ARRAY['public_page'::text, 'ai_chat'::text, 'phone'::text, 'manual'::text, 'other'::text]))),
    CONSTRAINT inquiries_status_check CHECK ((status = ANY (ARRAY['new'::text, 'open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text, 'spam'::text])))
);


--
-- Name: job_confirmation_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_confirmation_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    evidence_revision integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT job_confirmation_links_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT job_confirmation_links_token_hash_check CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))
);

ALTER TABLE ONLY public.job_confirmation_links FORCE ROW LEVEL SECURITY;


--
-- Name: job_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    evidence_revision integer NOT NULL,
    outcome text NOT NULL,
    actor_label text,
    confirmed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT job_confirmations_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT job_confirmations_outcome_check CHECK ((outcome = ANY (ARRAY['confirmed'::text, 'correction_requested'::text])))
);

ALTER TABLE ONLY public.job_confirmations FORCE ROW LEVEL SECURITY;


--
-- Name: job_evidence_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_evidence_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    uploader_user_id uuid NOT NULL,
    evidence_type text NOT NULL,
    storage_provider text NOT NULL,
    storage_object_key text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 text NOT NULL,
    server_received_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_capture_at timestamp with time zone,
    client_timezone text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    revision_number integer NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT job_evidence_assets_check CHECK (((storage_object_key ~~ (((((('stores/'::text || (store_id)::text) || '/jobs/'::text) || (job_id)::text) || '/revisions/'::text) || (revision_number)::text) || '/%'::text)) AND (POSITION(('..'::text) IN (storage_object_key)) = 0) AND (POSITION((chr(92)) IN (storage_object_key)) = 0))),
    CONSTRAINT job_evidence_assets_evidence_type_check CHECK ((evidence_type = ANY (ARRAY['before_photo'::text, 'during_photo'::text, 'after_photo'::text, 'video'::text, 'document'::text, 'checklist'::text, 'other'::text]))),
    CONSTRAINT job_evidence_assets_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'video/mp4'::text, 'application/pdf'::text, 'application/json'::text]))),
    CONSTRAINT job_evidence_assets_original_filename_check CHECK (((char_length(original_filename) >= 1) AND (char_length(original_filename) <= 255) AND (POSITION(('/'::text) IN (original_filename)) = 0) AND (POSITION((chr(92)) IN (original_filename)) = 0))),
    CONSTRAINT job_evidence_assets_revision_number_check CHECK ((revision_number > 0)),
    CONSTRAINT job_evidence_assets_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT job_evidence_assets_size_bytes_check CHECK (((size_bytes >= 1) AND (size_bytes <= 26214400))),
    CONSTRAINT job_evidence_assets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'quarantined'::text]))),
    CONSTRAINT job_evidence_assets_storage_provider_check CHECK ((storage_provider = ANY (ARRAY['local'::text, 'supabase'::text])))
);

ALTER TABLE ONLY public.job_evidence_assets FORCE ROW LEVEL SECURITY;


--
-- Name: job_evidence_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_evidence_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    revision_number integer NOT NULL,
    created_by uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT job_evidence_revisions_revision_number_check CHECK ((revision_number > 0))
);

ALTER TABLE ONLY public.job_evidence_revisions FORCE ROW LEVEL SECURITY;


--
-- Name: job_payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    job_id uuid NOT NULL,
    status text DEFAULT 'PAYMENT_NOT_REQUESTED'::text NOT NULL,
    amount numeric(12,2),
    currency text DEFAULT 'KRW'::text NOT NULL,
    provider text DEFAULT 'manual_tracking'::text NOT NULL,
    provider_reference text,
    requested_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT job_payment_requests_status_check CHECK ((status = ANY (ARRAY['PAYMENT_NOT_REQUESTED'::text, 'PAYMENT_REQUESTED'::text, 'PAYMENT_PENDING'::text, 'PAYMENT_PAID'::text, 'PAYMENT_FAILED'::text, 'PAYMENT_REFUNDED'::text])))
);

ALTER TABLE ONLY public.job_payment_requests FORCE ROW LEVEL SECURITY;


--
-- Name: lead_capture_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_capture_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    owner_profile_id uuid,
    source text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    store_name text NOT NULL,
    business_type text NOT NULL,
    address_summary text,
    contact_name text,
    contact_phone_encrypted text,
    contact_phone_masked text,
    contact_email_encrypted text,
    contact_email_masked text,
    main_concern text NOT NULL,
    desired_outcome text NOT NULL,
    current_customer_management text,
    current_reservation_flow text,
    current_inquiry_flow text,
    data_readiness text NOT NULL,
    pilot_fit_score integer,
    next_action text,
    owner_note text,
    memory_seed_summary text,
    consent_marketing boolean DEFAULT false NOT NULL,
    consent_contact boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT lead_capture_requests_data_readiness_check CHECK ((data_readiness = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT lead_capture_requests_pilot_fit_score_check CHECK (((pilot_fit_score >= 0) AND (pilot_fit_score <= 100))),
    CONSTRAINT lead_capture_requests_source_check CHECK ((source = ANY (ARRAY['onboarding'::text, 'pricing'::text, 'manual'::text, 'referral'::text]))),
    CONSTRAINT lead_capture_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'needs_review'::text, 'contacted'::text, 'pilot_candidate'::text, 'setup_in_progress'::text, 'converted'::text, 'rejected'::text, 'archived'::text])))
);


--
-- Name: market_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    address text,
    industry_key text NOT NULL,
    pain_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    snapshot_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: market_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_key text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    radius_m integer DEFAULT 700 NOT NULL,
    version text DEFAULT '0.1.0'::text NOT NULL,
    raw_sources jsonb DEFAULT '{}'::jsonb NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    freshness jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    category_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    menu_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    price integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    order_id_text text,
    source_order_key text,
    store_id uuid NOT NULL,
    customer_id uuid,
    product_id uuid,
    menu_item_id uuid,
    item_name text NOT NULL,
    menu_name text NOT NULL,
    option_summary text,
    quantity numeric DEFAULT 1 NOT NULL,
    unit_price integer,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    total_price integer,
    currency text DEFAULT 'KRW'::text NOT NULL,
    source text,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    order_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    table_id uuid NOT NULL,
    session_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_amount integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_source text,
    payment_method text,
    payment_recorded_at timestamp with time zone,
    customer_id uuid,
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'other'::text]))),
    CONSTRAINT orders_payment_source_check CHECK ((payment_source = ANY (ARRAY['counter'::text, 'mobile'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])))
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'portone'::text NOT NULL,
    event_id text,
    order_id text,
    user_id text,
    status text,
    amount integer,
    raw jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.payment_events FORCE ROW LEVEL SECURITY;


--
-- Name: platform_admin_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admin_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    role text DEFAULT 'platform_admin'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_admin_members_role_check CHECK ((role = ANY (ARRAY['platform_owner'::text, 'platform_admin'::text, 'platform_viewer'::text]))),
    CONSTRAINT platform_admin_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);


--
-- Name: platform_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    summary text,
    category text,
    audience text DEFAULT 'all'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    link_label text,
    link_href text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_announcements_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'visitors'::text, 'merchants'::text, 'admins'::text, 'specific'::text]))),
    CONSTRAINT platform_announcements_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: platform_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_profile_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    before_value jsonb,
    after_value jsonb,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    banner_key text NOT NULL,
    message text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    target_paths jsonb DEFAULT '[]'::jsonb NOT NULL,
    cta_label text,
    cta_href text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_banners_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: platform_billing_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_billing_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_code text NOT NULL,
    product_name text NOT NULL,
    product_type text NOT NULL,
    linked_plan_code text,
    amount integer NOT NULL,
    currency text DEFAULT 'KRW'::text NOT NULL,
    billing_cycle text,
    order_name text,
    description text,
    bullet_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    badge_text text,
    compare_at_amount integer,
    discount_label text,
    grants_entitlement boolean DEFAULT false NOT NULL,
    is_test_product boolean DEFAULT false NOT NULL,
    is_visible_public boolean DEFAULT false NOT NULL,
    visible_only_with_query text,
    visible_only_in_env text,
    sort_order integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_billing_products_amount_check CHECK ((amount >= 0)),
    CONSTRAINT platform_billing_products_compare_at_amount_check CHECK (((compare_at_amount IS NULL) OR (compare_at_amount >= 0))),
    CONSTRAINT platform_billing_products_linked_plan_code_check CHECK (((linked_plan_code IS NULL) OR (linked_plan_code = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text])))),
    CONSTRAINT platform_billing_products_product_type_check CHECK ((product_type = ANY (ARRAY['subscription'::text, 'one_time'::text, 'test'::text]))),
    CONSTRAINT platform_billing_products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT platform_billing_products_subscription_plan_required CHECK (((product_type <> 'subscription'::text) OR (linked_plan_code = ANY (ARRAY['pro'::text, 'vip'::text])))),
    CONSTRAINT platform_billing_products_test_no_entitlement CHECK (((NOT is_test_product) OR (grants_entitlement = false)))
);


--
-- Name: platform_board_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_board_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text NOT NULL,
    category text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    cover_image_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_board_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_content_quality_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_content_quality_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_key text NOT NULL,
    keyword text NOT NULL,
    severity text DEFAULT 'critical'::text NOT NULL,
    suggestion text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_content_quality_rules_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'warning'::text])))
);


--
-- Name: platform_content_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_content_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    version_label text,
    change_summary text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_effect_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_effect_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    preset_key text NOT NULL,
    title text NOT NULL,
    description text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_faq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_faq_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag_key text NOT NULL,
    description text,
    is_enabled boolean DEFAULT false NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_feature_flags_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'admin'::text, 'public'::text, 'merchant'::text])))
);


--
-- Name: platform_footer_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_footer_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    footer_company_name text DEFAULT 'MyBiz'::text NOT NULL,
    footer_business_info text,
    support_email text,
    support_phone text,
    footer_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_footer_settings_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_homepage_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_homepage_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    section_type text NOT NULL,
    title text,
    subtitle text,
    body text,
    eyebrow text,
    cta_label text,
    cta_href text,
    media_url text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_homepage_sections_section_type_check CHECK ((section_type = ANY (ARRAY['hero'::text, 'value_cards'::text, 'problem'::text, 'solution'::text, 'customer_memory_flow'::text, 'features'::text, 'pricing_teaser'::text, 'testimonials'::text, 'faq'::text, 'final_cta'::text, 'custom_json'::text]))),
    CONSTRAINT platform_homepage_sections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    storage_path text,
    file_name text,
    mime_type text,
    size_bytes integer,
    width integer,
    height integer,
    alt_text text,
    usage_context text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_page_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_page_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_slug text NOT NULL,
    section_key text NOT NULL,
    section_type text DEFAULT 'content'::text NOT NULL,
    title text,
    subtitle text,
    body text,
    cta_label text,
    cta_href text,
    media_url text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_page_sections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    body text,
    cta_label text,
    cta_href text,
    hero_media_url text,
    seo_title text,
    seo_description text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_popups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_popups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    popup_key text NOT NULL,
    title text NOT NULL,
    body text,
    image_url text,
    popup_type text DEFAULT 'modal'::text NOT NULL,
    audience text DEFAULT 'all'::text NOT NULL,
    target_paths jsonb DEFAULT '[]'::jsonb NOT NULL,
    exclude_paths jsonb DEFAULT '[]'::jsonb NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    frequency_policy text DEFAULT 'once_per_session'::text NOT NULL,
    dismissible boolean DEFAULT true NOT NULL,
    cta_label text,
    cta_href text,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_popups_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'visitors'::text, 'merchants'::text, 'admins'::text]))),
    CONSTRAINT platform_popups_frequency_policy_check CHECK ((frequency_policy = ANY (ARRAY['once_per_session'::text, 'once_per_day'::text, 'always'::text]))),
    CONSTRAINT platform_popups_popup_type_check CHECK ((popup_type = ANY (ARRAY['modal'::text, 'banner'::text, 'toast'::text, 'bottom_sheet'::text]))),
    CONSTRAINT platform_popups_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_pricing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_code text NOT NULL,
    display_name text NOT NULL,
    badge_text text,
    price_amount integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'KRW'::text NOT NULL,
    billing_cycle text DEFAULT 'month'::text NOT NULL,
    compare_at_amount integer,
    discount_label text,
    short_description text,
    bullet_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    footnote text,
    cta_label text,
    cta_action text DEFAULT 'onboarding'::text NOT NULL,
    cta_href text,
    is_recommended boolean DEFAULT false NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_pricing_plans_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['free'::text, 'month'::text, 'year'::text, 'one_time'::text]))),
    CONSTRAINT platform_pricing_plans_compare_at_amount_check CHECK (((compare_at_amount IS NULL) OR (compare_at_amount >= 0))),
    CONSTRAINT platform_pricing_plans_cta_action_check CHECK ((cta_action = ANY (ARRAY['onboarding'::text, 'checkout'::text, 'contact'::text, 'disabled'::text]))),
    CONSTRAINT platform_pricing_plans_plan_code_check CHECK ((plan_code = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text]))),
    CONSTRAINT platform_pricing_plans_price_amount_check CHECK ((price_amount >= 0)),
    CONSTRAINT platform_pricing_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: platform_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_code text NOT NULL,
    title text NOT NULL,
    label text,
    description text,
    applies_to_type text NOT NULL,
    applies_to_code text,
    display_mode text DEFAULT 'badge'::text NOT NULL,
    discount_type text,
    discount_value integer,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT false NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_promotions_applies_to_type_check CHECK ((applies_to_type = ANY (ARRAY['plan'::text, 'product'::text, 'homepage'::text, 'custom'::text]))),
    CONSTRAINT platform_promotions_discount_type_check CHECK (((discount_type IS NULL) OR (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text, 'display_only'::text])))),
    CONSTRAINT platform_promotions_display_mode_check CHECK ((display_mode = ANY (ARRAY['badge'::text, 'compare_at'::text, 'notice'::text, 'banner'::text])))
);


--
-- Name: platform_site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_name text DEFAULT 'MyBiz'::text NOT NULL,
    homepage_status text DEFAULT 'published'::text NOT NULL,
    seo_title text,
    seo_description text,
    og_image_url text,
    primary_cta_label text,
    primary_cta_href text,
    secondary_cta_label text,
    secondary_cta_href text,
    support_email text,
    support_phone text,
    footer_company_name text,
    footer_business_info text,
    footer_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_site_settings_homepage_status_check CHECK ((homepage_status = ANY (ARRAY['draft'::text, 'published'::text, 'maintenance'::text])))
);


--
-- Name: platform_site_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_site_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_key text NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    quality_score integer DEFAULT 100 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT platform_site_snapshots_status_check CHECK ((status = ANY (ARRAY['published'::text, 'archived'::text, 'rollback_candidate'::text])))
);


--
-- Name: platform_trust_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_trust_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signal_key text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    icon_key text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    phone text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    visitor_session_id uuid,
    source text DEFAULT 'public_page'::text NOT NULL,
    party_size integer DEFAULT 1 NOT NULL,
    reserved_at timestamp with time zone NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservations_source_check CHECK ((source = ANY (ARRAY['public_page'::text, 'ai_chat'::text, 'phone'::text, 'manual'::text, 'walk_in'::text]))),
    CONSTRAINT reservations_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'seated'::text, 'completed'::text, 'canceled'::text, 'no_show'::text])))
);


--
-- Name: review_request_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_request_links (
    link_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    created_by uuid,
    source_type text DEFAULT 'store'::text NOT NULL,
    source_id text,
    url text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    submission_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    public_token text,
    expires_at timestamp with time zone,
    disabled_at timestamp with time zone,
    max_uses integer,
    CONSTRAINT review_request_links_max_uses_check CHECK (((max_uses IS NULL) OR (max_uses > 0))),
    CONSTRAINT review_request_links_source_type_check CHECK ((source_type = ANY (ARRAY['store'::text, 'order'::text, 'reservation'::text, 'waiting'::text, 'customer'::text]))),
    CONSTRAINT review_request_links_submission_count_check CHECK ((submission_count >= 0)),
    CONSTRAINT review_request_links_usage_count_check CHECK ((usage_count >= 0))
);


--
-- Name: service_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    vertical text NOT NULL,
    service_name text NOT NULL,
    requires_contract boolean DEFAULT false NOT NULL,
    contract_state text DEFAULT 'NOT_REQUIRED'::text NOT NULL,
    state text DEFAULT 'JOB_CREATED'::text NOT NULL,
    evidence_revision integer DEFAULT 1 NOT NULL,
    payment_state text DEFAULT 'PAYMENT_NOT_REQUESTED'::text NOT NULL,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT service_jobs_check CHECK (((requires_contract AND (contract_state <> 'NOT_REQUIRED'::text)) OR ((NOT requires_contract) AND (contract_state = 'NOT_REQUIRED'::text)))),
    CONSTRAINT service_jobs_check1 CHECK (((state = ANY (ARRAY['JOB_CREATED'::text, 'CONTRACT_REQUIRED'::text])) OR (NOT requires_contract) OR (contract_state = ANY (ARRAY['ACCEPTED'::text, 'SIGNED'::text])))),
    CONSTRAINT service_jobs_contract_state_check CHECK ((contract_state = ANY (ARRAY['NOT_REQUIRED'::text, 'DRAFT'::text, 'SENT'::text, 'ACCEPTED'::text, 'SIGNED'::text]))),
    CONSTRAINT service_jobs_evidence_revision_check CHECK ((evidence_revision > 0)),
    CONSTRAINT service_jobs_payment_state_check CHECK ((payment_state = ANY (ARRAY['PAYMENT_NOT_REQUESTED'::text, 'PAYMENT_REQUESTED'::text, 'PAYMENT_PENDING'::text, 'PAYMENT_PAID'::text, 'PAYMENT_FAILED'::text, 'PAYMENT_REFUNDED'::text]))),
    CONSTRAINT service_jobs_state_check CHECK ((state = ANY (ARRAY['JOB_CREATED'::text, 'CONTRACT_REQUIRED'::text, 'WORK_READY'::text, 'WORK_IN_PROGRESS'::text, 'WORK_COMPLETED'::text, 'CUSTOMER_CONFIRMED'::text, 'CUSTOMER_CORRECTION_REQUESTED'::text, 'CONFIRMATION_OUTDATED'::text]))),
    CONSTRAINT service_jobs_vertical_check CHECK ((vertical = ANY (ARRAY['cleaning'::text, 'hair'::text, 'installation'::text, 'wig'::text, 'interior'::text, 'medical'::text])))
);

ALTER TABLE ONLY public.service_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    table_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    channel text DEFAULT 'qr_web'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    user_agent text,
    ip_hash text
);


--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_accounts (
    account_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    provider text NOT NULL,
    provider_account_id text,
    display_name text,
    oauth_status text DEFAULT 'not_connected'::text NOT NULL,
    access_token_encrypted text,
    refresh_token_encrypted text,
    token_expires_at timestamp with time zone,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT social_accounts_oauth_status_check CHECK ((oauth_status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'expired'::text, 'revoked'::text, 'disabled'::text]))),
    CONSTRAINT social_accounts_provider_check CHECK ((provider = ANY (ARRAY['youtube'::text, 'tiktok'::text, 'threads'::text, 'naver_blog'::text, 'kakao_share'::text])))
);


--
-- Name: social_publish_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_publish_jobs (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    provider text NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    caption text,
    hashtags jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    provider_post_id text,
    provider_url text,
    error_code text,
    error_message text,
    approved_by uuid,
    approved_at timestamp with time zone,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT social_publish_jobs_provider_check CHECK ((provider = ANY (ARRAY['youtube'::text, 'tiktok'::text, 'threads'::text, 'naver_blog'::text, 'kakao_share'::text, 'mybiz_blog'::text]))),
    CONSTRAINT social_publish_jobs_source_type_check CHECK ((source_type = ANY (ARRAY['review'::text, 'blog_post'::text, 'media'::text, 'manual'::text]))),
    CONSTRAINT social_publish_jobs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'waiting_approval'::text, 'queued'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: store_analytics_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    industry text,
    region text,
    customer_focus text,
    analytics_preset text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1
);


--
-- Name: store_analytics_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    industry text NOT NULL,
    region text NOT NULL,
    customer_focus text NOT NULL,
    analytics_preset text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: store_blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_blog_posts (
    post_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    author_profile_id uuid,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_review_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    body text NOT NULL,
    cover_image_url text,
    media_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    seo_title text,
    seo_description text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT store_blog_posts_source_type_check CHECK ((source_type = ANY (ARRAY['manual'::text, 'review'::text, 'ai'::text, 'video'::text, 'campaign'::text]))),
    CONSTRAINT store_blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: store_daily_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_daily_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    metric_date date NOT NULL,
    revenue_total numeric DEFAULT 0,
    revenue_growth_rate numeric DEFAULT 0,
    orders_count integer DEFAULT 0,
    avg_order_value numeric DEFAULT 0,
    new_customers integer DEFAULT 0,
    repeat_customers integer DEFAULT 0,
    repeat_customer_rate numeric DEFAULT 0,
    reservation_count integer DEFAULT 0,
    reservation_no_show_rate numeric DEFAULT 0,
    consultation_count integer DEFAULT 0,
    consultation_conversion_rate numeric DEFAULT 0,
    review_count integer DEFAULT 0,
    review_response_rate numeric DEFAULT 0,
    operations_score numeric DEFAULT 0,
    waiting_dropoff_rate numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1
);


--
-- Name: store_home_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_home_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    hero_title text,
    hero_subtitle text,
    notice_text text,
    contact_enabled boolean DEFAULT true,
    consultation_enabled boolean DEFAULT true,
    reservation_enabled boolean DEFAULT true,
    layout_mode text DEFAULT 'default'::text,
    updated_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1
);


--
-- Name: store_media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_media_assets (
    asset_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    uploaded_by uuid,
    asset_type text NOT NULL,
    url text NOT NULL,
    storage_path text,
    thumbnail_url text,
    alt_text text,
    duration_seconds integer,
    transcript text,
    captions_vtt text,
    captions_srt text,
    ai_title text,
    ai_description text,
    ai_hashtags jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT store_media_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT store_media_assets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: store_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT store_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])))
);


--
-- Name: store_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    module_key text NOT NULL,
    status text DEFAULT 'locked'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_oauth_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_oauth_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    provider text NOT NULL,
    client_id text,
    client_secret text,
    redirect_uri text,
    extra_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_priority_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_priority_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id text NOT NULL,
    revenue_weight numeric DEFAULT 0.25,
    repeat_customer_weight numeric DEFAULT 0.25,
    reservation_weight numeric DEFAULT 0.15,
    consultation_weight numeric DEFAULT 0.10,
    branding_weight numeric DEFAULT 0.15,
    order_efficiency_weight numeric DEFAULT 0.10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1
);


--
-- Name: store_public_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_public_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    page_title text,
    hero_title text,
    hero_subtitle text,
    intro_text text,
    cta_primary_label text,
    cta_primary_target text,
    inquiry_enabled boolean DEFAULT true NOT NULL,
    reservation_enabled boolean DEFAULT false NOT NULL,
    waiting_enabled boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    seo_title text,
    seo_description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    order_id uuid,
    reservation_id uuid,
    rating integer NOT NULL,
    title text,
    body text NOT NULL,
    media_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    reviewer_display_name text,
    marketing_consent boolean DEFAULT false NOT NULL,
    content_usage_consent boolean DEFAULT false NOT NULL,
    visibility_status text DEFAULT 'pending'::text NOT NULL,
    sentiment text,
    keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_summary text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT store_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT store_reviews_visibility_status_check CHECK ((visibility_status = ANY (ARRAY['pending'::text, 'published'::text, 'hidden'::text, 'reported'::text])))
);


--
-- Name: store_setup_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_setup_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid,
    business_name text NOT NULL,
    owner_name text NOT NULL,
    business_number text,
    phone text,
    email text,
    address text,
    business_type text,
    requested_slug text,
    selected_features jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    converted_store_id uuid,
    requested_plan text DEFAULT 'free'::text NOT NULL,
    CONSTRAINT store_setup_requests_requested_plan_check CHECK ((requested_plan = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text])))
);


--
-- Name: store_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_staff (
    store_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    plan text NOT NULL,
    status text NOT NULL,
    billing_provider text,
    trial_ends_at timestamp with time zone,
    current_period_starts_at timestamp with time zone,
    current_period_ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT store_subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'vip'::text]))),
    CONSTRAINT store_subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text])))
);


--
-- Name: TABLE store_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_subscriptions IS 'Canonical entitlement truth for MyBiz stores. Backfilled from legacy public.subscriptions on 2026-04-24.';


--
-- Name: store_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_tables (
    table_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    table_no integer NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    status_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    store_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'Asia/Seoul'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    slug text,
    trial_ends_at timestamp with time zone,
    plan text
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'inactive'::text NOT NULL,
    billing_key text,
    started_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    last_payment_status text,
    last_order_id text,
    cancel_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.subscriptions FORCE ROW LEVEL SECURITY;


--
-- Name: vertical_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vertical_templates (
    id text NOT NULL,
    label text NOT NULL,
    public_v1 boolean DEFAULT false NOT NULL,
    medical_mode boolean DEFAULT false NOT NULL,
    custom_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT vertical_templates_check CHECK (((NOT public_v1) OR (id = ANY (ARRAY['cleaning'::text, 'hair'::text, 'installation'::text])))),
    CONSTRAINT vertical_templates_check1 CHECK (((NOT medical_mode) OR (id = 'medical'::text))),
    CONSTRAINT vertical_templates_check2 CHECK ((NOT ((id = 'medical'::text) AND public_v1))),
    CONSTRAINT vertical_templates_id_check CHECK ((id = ANY (ARRAY['cleaning'::text, 'hair'::text, 'installation'::text, 'wig'::text, 'interior'::text, 'medical'::text])))
);

ALTER TABLE ONLY public.vertical_templates FORCE ROW LEVEL SECURITY;


--
-- Name: visitor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    source text,
    landing_path text,
    referrer text,
    device_type text,
    ip_hash text,
    customer_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone
);


--
-- Name: waiting_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiting_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    visitor_session_id uuid,
    source text DEFAULT 'kiosk'::text NOT NULL,
    party_size integer DEFAULT 1 NOT NULL,
    quoted_minutes integer,
    status text DEFAULT 'waiting'::text NOT NULL,
    phone_snapshot text,
    name_snapshot text,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    seated_at timestamp with time zone,
    CONSTRAINT waiting_entries_source_check CHECK ((source = ANY (ARRAY['kiosk'::text, 'public_page'::text, 'staff'::text, 'other'::text]))),
    CONSTRAINT waiting_entries_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'called'::text, 'seated'::text, 'left'::text, 'canceled'::text])))
);


--
-- Name: commercial_submissions commercial_submissions_pkey; Type: CONSTRAINT; Schema: biz2lab; Owner: -
--

ALTER TABLE ONLY biz2lab.commercial_submissions
    ADD CONSTRAINT commercial_submissions_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_organization_id_profile_id_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_organization_id_profile_id_key UNIQUE (organization_id, profile_id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profile_auth_bindings profile_auth_bindings_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.profile_auth_bindings
    ADD CONSTRAINT profile_auth_bindings_pkey PRIMARY KEY (id);


--
-- Name: store_provisioning_receipts store_provisioning_receipts_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.store_provisioning_receipts
    ADD CONSTRAINT store_provisioning_receipts_pkey PRIMARY KEY (actor_auth_user_id, request_key);


--
-- Name: store_provisioning_receipts store_provisioning_receipts_store_id_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.store_provisioning_receipts
    ADD CONSTRAINT store_provisioning_receipts_store_id_key UNIQUE (store_id);


--
-- Name: ai_briefing_logs ai_briefing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_briefing_logs
    ADD CONSTRAINT ai_briefing_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_reports ai_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT ai_reports_pkey PRIMARY KEY (id);


--
-- Name: brand_site_portfolio_items brand_site_portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_site_portfolio_items
    ADD CONSTRAINT brand_site_portfolio_items_pkey PRIMARY KEY (id);


--
-- Name: brand_sites brand_sites_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_sites
    ADD CONSTRAINT brand_sites_id_store_id_key UNIQUE (id, store_id);


--
-- Name: brand_sites brand_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_sites
    ADD CONSTRAINT brand_sites_pkey PRIMARY KEY (id);


--
-- Name: brand_sites brand_sites_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_sites
    ADD CONSTRAINT brand_sites_slug_key UNIQUE (slug);


--
-- Name: brand_sites brand_sites_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_sites
    ADD CONSTRAINT brand_sites_store_id_key UNIQUE (store_id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: content_candidates content_candidates_id_job_id_evidence_revision_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_candidates
    ADD CONSTRAINT content_candidates_id_job_id_evidence_revision_store_id_key UNIQUE (id, job_id, evidence_revision, store_id);


--
-- Name: content_candidates content_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_candidates
    ADD CONSTRAINT content_candidates_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversation_sessions conversation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_contacts customer_contacts_customer_id_contact_type_normalized_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_contact_type_normalized_value_key UNIQUE (customer_id, contact_type, normalized_value);


--
-- Name: customer_contacts customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: customer_preferences customer_preferences_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_key UNIQUE (customer_id);


--
-- Name: customer_preferences customer_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_pkey PRIMARY KEY (id);


--
-- Name: customer_recommendation_actions customer_recommendation_actio_store_id_customer_id_recommen_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_recommendation_actions
    ADD CONSTRAINT customer_recommendation_actio_store_id_customer_id_recommen_key UNIQUE (store_id, customer_id, recommendation_key);


--
-- Name: customer_recommendation_actions customer_recommendation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_recommendation_actions
    ADD CONSTRAINT customer_recommendation_actions_pkey PRIMARY KEY (action_id);


--
-- Name: customer_timeline_events customer_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_timeline_events
    ADD CONSTRAINT customer_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_store_id_customer_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_customer_key_key UNIQUE (store_id, customer_key);


--
-- Name: diagnosis_runs diagnosis_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosis_runs
    ADD CONSTRAINT diagnosis_runs_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: job_confirmation_links job_confirmation_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmation_links
    ADD CONSTRAINT job_confirmation_links_pkey PRIMARY KEY (id);


--
-- Name: job_confirmation_links job_confirmation_links_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmation_links
    ADD CONSTRAINT job_confirmation_links_token_hash_key UNIQUE (token_hash);


--
-- Name: job_confirmations job_confirmations_job_id_evidence_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmations
    ADD CONSTRAINT job_confirmations_job_id_evidence_revision_key UNIQUE (job_id, evidence_revision);


--
-- Name: job_confirmations job_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmations
    ADD CONSTRAINT job_confirmations_pkey PRIMARY KEY (id);


--
-- Name: job_evidence_assets job_evidence_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_pkey PRIMARY KEY (id);


--
-- Name: job_evidence_assets job_evidence_assets_store_id_storage_provider_storage_objec_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_store_id_storage_provider_storage_objec_key UNIQUE (store_id, storage_provider, storage_object_key);


--
-- Name: job_evidence_revisions job_evidence_revisions_job_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_job_id_revision_number_key UNIQUE (job_id, revision_number);


--
-- Name: job_evidence_revisions job_evidence_revisions_job_id_revision_number_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_job_id_revision_number_store_id_key UNIQUE (job_id, revision_number, store_id);


--
-- Name: job_evidence_revisions job_evidence_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_pkey PRIMARY KEY (id);


--
-- Name: job_payment_requests job_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_payment_requests
    ADD CONSTRAINT job_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: lead_capture_requests lead_capture_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_capture_requests
    ADD CONSTRAINT lead_capture_requests_pkey PRIMARY KEY (id);


--
-- Name: market_requests market_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_requests
    ADD CONSTRAINT market_requests_pkey PRIMARY KEY (id);


--
-- Name: market_snapshots market_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_snapshots
    ADD CONSTRAINT market_snapshots_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (category_id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (menu_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_quantity_nonnegative; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_quantity_nonnegative CHECK ((quantity >= (0)::numeric)) NOT VALID;


--
-- Name: order_items order_items_total_price_nonnegative; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_total_price_nonnegative CHECK (((total_price IS NULL) OR (total_price >= 0))) NOT VALID;


--
-- Name: order_items order_items_unit_price_nonnegative; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_unit_price_nonnegative CHECK (((unit_price IS NULL) OR (unit_price >= 0))) NOT VALID;


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: platform_admin_members platform_admin_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_members
    ADD CONSTRAINT platform_admin_members_pkey PRIMARY KEY (id);


--
-- Name: platform_admin_members platform_admin_members_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_members
    ADD CONSTRAINT platform_admin_members_profile_id_key UNIQUE (profile_id);


--
-- Name: platform_announcements platform_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_announcements
    ADD CONSTRAINT platform_announcements_pkey PRIMARY KEY (id);


--
-- Name: platform_audit_logs platform_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: platform_banners platform_banners_banner_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_banners
    ADD CONSTRAINT platform_banners_banner_key_key UNIQUE (banner_key);


--
-- Name: platform_banners platform_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_banners
    ADD CONSTRAINT platform_banners_pkey PRIMARY KEY (id);


--
-- Name: platform_billing_products platform_billing_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_billing_products
    ADD CONSTRAINT platform_billing_products_pkey PRIMARY KEY (id);


--
-- Name: platform_billing_products platform_billing_products_product_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_billing_products
    ADD CONSTRAINT platform_billing_products_product_code_key UNIQUE (product_code);


--
-- Name: platform_board_posts platform_board_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_board_posts
    ADD CONSTRAINT platform_board_posts_pkey PRIMARY KEY (id);


--
-- Name: platform_board_posts platform_board_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_board_posts
    ADD CONSTRAINT platform_board_posts_slug_key UNIQUE (slug);


--
-- Name: platform_content_quality_rules platform_content_quality_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_content_quality_rules
    ADD CONSTRAINT platform_content_quality_rules_pkey PRIMARY KEY (id);


--
-- Name: platform_content_quality_rules platform_content_quality_rules_rule_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_content_quality_rules
    ADD CONSTRAINT platform_content_quality_rules_rule_key_key UNIQUE (rule_key);


--
-- Name: platform_content_versions platform_content_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_content_versions
    ADD CONSTRAINT platform_content_versions_pkey PRIMARY KEY (id);


--
-- Name: platform_effect_presets platform_effect_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_effect_presets
    ADD CONSTRAINT platform_effect_presets_pkey PRIMARY KEY (id);


--
-- Name: platform_effect_presets platform_effect_presets_preset_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_effect_presets
    ADD CONSTRAINT platform_effect_presets_preset_key_key UNIQUE (preset_key);


--
-- Name: platform_faq_items platform_faq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_faq_items
    ADD CONSTRAINT platform_faq_items_pkey PRIMARY KEY (id);


--
-- Name: platform_faq_items platform_faq_items_question_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_faq_items
    ADD CONSTRAINT platform_faq_items_question_key UNIQUE (question);


--
-- Name: platform_feature_flags platform_feature_flags_flag_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_flag_key_key UNIQUE (flag_key);


--
-- Name: platform_feature_flags platform_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: platform_footer_settings platform_footer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_footer_settings
    ADD CONSTRAINT platform_footer_settings_pkey PRIMARY KEY (id);


--
-- Name: platform_homepage_sections platform_homepage_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_homepage_sections
    ADD CONSTRAINT platform_homepage_sections_pkey PRIMARY KEY (id);


--
-- Name: platform_homepage_sections platform_homepage_sections_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_homepage_sections
    ADD CONSTRAINT platform_homepage_sections_section_key_key UNIQUE (section_key);


--
-- Name: platform_media_assets platform_media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_media_assets
    ADD CONSTRAINT platform_media_assets_pkey PRIMARY KEY (id);


--
-- Name: platform_page_sections platform_page_sections_page_slug_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_page_sections
    ADD CONSTRAINT platform_page_sections_page_slug_section_key_key UNIQUE (page_slug, section_key);


--
-- Name: platform_page_sections platform_page_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_page_sections
    ADD CONSTRAINT platform_page_sections_pkey PRIMARY KEY (id);


--
-- Name: platform_pages platform_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages
    ADD CONSTRAINT platform_pages_pkey PRIMARY KEY (id);


--
-- Name: platform_pages platform_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages
    ADD CONSTRAINT platform_pages_slug_key UNIQUE (slug);


--
-- Name: platform_popups platform_popups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_popups
    ADD CONSTRAINT platform_popups_pkey PRIMARY KEY (id);


--
-- Name: platform_popups platform_popups_popup_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_popups
    ADD CONSTRAINT platform_popups_popup_key_key UNIQUE (popup_key);


--
-- Name: platform_pricing_plans platform_pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pricing_plans
    ADD CONSTRAINT platform_pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: platform_pricing_plans platform_pricing_plans_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pricing_plans
    ADD CONSTRAINT platform_pricing_plans_plan_code_key UNIQUE (plan_code);


--
-- Name: platform_promotions platform_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_promotions
    ADD CONSTRAINT platform_promotions_pkey PRIMARY KEY (id);


--
-- Name: platform_promotions platform_promotions_promotion_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_promotions
    ADD CONSTRAINT platform_promotions_promotion_code_key UNIQUE (promotion_code);


--
-- Name: platform_site_settings platform_site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_site_settings
    ADD CONSTRAINT platform_site_settings_pkey PRIMARY KEY (id);


--
-- Name: platform_site_snapshots platform_site_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_site_snapshots
    ADD CONSTRAINT platform_site_snapshots_pkey PRIMARY KEY (id);


--
-- Name: platform_site_snapshots platform_site_snapshots_snapshot_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_site_snapshots
    ADD CONSTRAINT platform_site_snapshots_snapshot_key_key UNIQUE (snapshot_key);


--
-- Name: platform_trust_signals platform_trust_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_trust_signals
    ADD CONSTRAINT platform_trust_signals_pkey PRIMARY KEY (id);


--
-- Name: platform_trust_signals platform_trust_signals_signal_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_trust_signals
    ADD CONSTRAINT platform_trust_signals_signal_key_key UNIQUE (signal_key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: review_request_links review_request_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_links
    ADD CONSTRAINT review_request_links_pkey PRIMARY KEY (link_id);


--
-- Name: service_jobs service_jobs_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_jobs
    ADD CONSTRAINT service_jobs_id_store_id_key UNIQUE (id, store_id);


--
-- Name: service_jobs service_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_jobs
    ADD CONSTRAINT service_jobs_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (session_id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: social_accounts social_accounts_store_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_store_id_provider_key UNIQUE (store_id, provider);


--
-- Name: social_publish_jobs social_publish_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publish_jobs
    ADD CONSTRAINT social_publish_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: store_analytics_profile store_analytics_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_profile
    ADD CONSTRAINT store_analytics_profile_pkey PRIMARY KEY (id);


--
-- Name: store_analytics_profiles store_analytics_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_profiles
    ADD CONSTRAINT store_analytics_profiles_pkey PRIMARY KEY (id);


--
-- Name: store_analytics_profiles store_analytics_profiles_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_profiles
    ADD CONSTRAINT store_analytics_profiles_store_id_key UNIQUE (store_id);


--
-- Name: store_blog_posts store_blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_blog_posts
    ADD CONSTRAINT store_blog_posts_pkey PRIMARY KEY (post_id);


--
-- Name: store_blog_posts store_blog_posts_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_blog_posts
    ADD CONSTRAINT store_blog_posts_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: store_daily_metrics store_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_metrics
    ADD CONSTRAINT store_daily_metrics_pkey PRIMARY KEY (id);


--
-- Name: store_home_content store_home_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_home_content
    ADD CONSTRAINT store_home_content_pkey PRIMARY KEY (id);


--
-- Name: store_home_content store_home_content_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_home_content
    ADD CONSTRAINT store_home_content_store_id_key UNIQUE (store_id);


--
-- Name: store_media_assets store_media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_media_assets
    ADD CONSTRAINT store_media_assets_pkey PRIMARY KEY (asset_id);


--
-- Name: store_members store_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_members
    ADD CONSTRAINT store_members_pkey PRIMARY KEY (id);


--
-- Name: store_members store_members_store_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_members
    ADD CONSTRAINT store_members_store_id_profile_id_key UNIQUE (store_id, profile_id);


--
-- Name: store_modules store_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_modules
    ADD CONSTRAINT store_modules_pkey PRIMARY KEY (id);


--
-- Name: store_modules store_modules_store_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_modules
    ADD CONSTRAINT store_modules_store_id_module_key_key UNIQUE (store_id, module_key);


--
-- Name: store_oauth_credentials store_oauth_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_oauth_credentials
    ADD CONSTRAINT store_oauth_credentials_pkey PRIMARY KEY (id);


--
-- Name: store_oauth_credentials store_oauth_credentials_store_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_oauth_credentials
    ADD CONSTRAINT store_oauth_credentials_store_id_provider_key UNIQUE (store_id, provider);


--
-- Name: store_priority_settings store_priority_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_priority_settings
    ADD CONSTRAINT store_priority_settings_pkey PRIMARY KEY (id);


--
-- Name: store_priority_settings store_priority_settings_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_priority_settings
    ADD CONSTRAINT store_priority_settings_store_id_key UNIQUE (store_id);


--
-- Name: store_public_pages store_public_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_public_pages
    ADD CONSTRAINT store_public_pages_pkey PRIMARY KEY (id);


--
-- Name: store_public_pages store_public_pages_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_public_pages
    ADD CONSTRAINT store_public_pages_store_id_key UNIQUE (store_id);


--
-- Name: store_reviews store_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reviews
    ADD CONSTRAINT store_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: store_setup_requests store_setup_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_setup_requests
    ADD CONSTRAINT store_setup_requests_pkey PRIMARY KEY (id);


--
-- Name: store_staff store_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_staff
    ADD CONSTRAINT store_staff_pkey PRIMARY KEY (store_id, user_id);


--
-- Name: store_subscriptions store_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_subscriptions
    ADD CONSTRAINT store_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: store_subscriptions store_subscriptions_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_subscriptions
    ADD CONSTRAINT store_subscriptions_store_id_key UNIQUE (store_id);


--
-- Name: store_tables store_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_tables
    ADD CONSTRAINT store_tables_pkey PRIMARY KEY (table_id);


--
-- Name: store_tables store_tables_store_id_table_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_tables
    ADD CONSTRAINT store_tables_store_id_table_no_key UNIQUE (store_id, table_no);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: vertical_templates vertical_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vertical_templates
    ADD CONSTRAINT vertical_templates_pkey PRIMARY KEY (id);


--
-- Name: visitor_sessions visitor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (id);


--
-- Name: waiting_entries waiting_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_entries
    ADD CONSTRAINT waiting_entries_pkey PRIMARY KEY (id);


--
-- Name: commercial_submissions_atomic_dedupe_idx; Type: INDEX; Schema: biz2lab; Owner: -
--

CREATE UNIQUE INDEX commercial_submissions_atomic_dedupe_idx ON biz2lab.commercial_submissions USING btree (service, kind, email, date_bin('00:10:00'::interval, created_at, '2000-01-01 00:00:00+00'::timestamp with time zone));


--
-- Name: commercial_submissions_repeat_lookup_idx; Type: INDEX; Schema: biz2lab; Owner: -
--

CREATE INDEX commercial_submissions_repeat_lookup_idx ON biz2lab.commercial_submissions USING btree (service, kind, email, created_at DESC);


--
-- Name: memberships_profile_status_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX memberships_profile_status_idx ON core.memberships USING btree (profile_id, status);


--
-- Name: profile_auth_bindings_active_auth_uidx; Type: INDEX; Schema: private; Owner: -
--

CREATE UNIQUE INDEX profile_auth_bindings_active_auth_uidx ON private.profile_auth_bindings USING btree (auth_profile_id) WHERE ((status = 'ACTIVE'::text) AND (revoked_at IS NULL));


--
-- Name: profile_auth_bindings_active_public_uidx; Type: INDEX; Schema: private; Owner: -
--

CREATE UNIQUE INDEX profile_auth_bindings_active_public_uidx ON private.profile_auth_bindings USING btree (public_profile_id) WHERE ((status = 'ACTIVE'::text) AND (revoked_at IS NULL));


--
-- Name: profile_auth_bindings_auth_lookup_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX profile_auth_bindings_auth_lookup_idx ON private.profile_auth_bindings USING btree (auth_profile_id, status);


--
-- Name: store_provisioning_receipts_payment_id_unique; Type: INDEX; Schema: private; Owner: -
--

CREATE UNIQUE INDEX store_provisioning_receipts_payment_id_unique ON private.store_provisioning_receipts USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: consent_records_job_revision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_records_job_revision_idx ON public.consent_records USING btree (job_id, evidence_revision, purpose, granted_at DESC);


--
-- Name: content_candidates_store_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_candidates_store_status_idx ON public.content_candidates USING btree (store_id, status, created_at DESC);


--
-- Name: customer_contacts_store_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_contacts_store_customer_idx ON public.customer_contacts USING btree (store_id, customer_id);


--
-- Name: customer_contacts_store_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_contacts_store_email_unique ON public.customer_contacts USING btree (store_id, normalized_value) WHERE ((contact_type = 'email'::text) AND (normalized_value IS NOT NULL) AND (normalized_value <> ''::text));


--
-- Name: customer_contacts_store_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_contacts_store_phone_unique ON public.customer_contacts USING btree (store_id, normalized_value) WHERE ((contact_type = 'phone'::text) AND (normalized_value IS NOT NULL) AND (normalized_value <> ''::text));


--
-- Name: customer_recommendation_actions_store_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_recommendation_actions_store_customer_idx ON public.customer_recommendation_actions USING btree (store_id, customer_id);


--
-- Name: customer_recommendation_actions_store_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_recommendation_actions_store_status_idx ON public.customer_recommendation_actions USING btree (store_id, status, updated_at DESC);


--
-- Name: customer_timeline_events_store_customer_event_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_timeline_events_store_customer_event_created_idx ON public.customer_timeline_events USING btree (store_id, customer_id, event_type, created_at);


--
-- Name: customers_store_normalized_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_store_normalized_email_idx ON public.customers USING btree (store_id, normalized_email) WHERE ((normalized_email IS NOT NULL) AND (normalized_email <> ''::text));


--
-- Name: customers_store_normalized_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_store_normalized_phone_idx ON public.customers USING btree (store_id, normalized_phone) WHERE ((normalized_phone IS NOT NULL) AND (normalized_phone <> ''::text));


--
-- Name: diagnosis_runs_cohort_key_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diagnosis_runs_cohort_key_created_at_idx ON public.diagnosis_runs USING btree (cohort_key, created_at DESC);


--
-- Name: diagnosis_runs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diagnosis_runs_created_at_idx ON public.diagnosis_runs USING btree (created_at DESC);


--
-- Name: diagnosis_runs_request_id_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX diagnosis_runs_request_id_uniq ON public.diagnosis_runs USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: diagnosis_runs_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diagnosis_runs_run_id_idx ON public.diagnosis_runs USING btree (run_id);


--
-- Name: diagnosis_runs_run_id_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX diagnosis_runs_run_id_uniq ON public.diagnosis_runs USING btree (run_id);


--
-- Name: diagnosis_runs_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diagnosis_runs_user_id_created_at_idx ON public.diagnosis_runs USING btree (user_id, created_at DESC);


--
-- Name: diagnosis_runs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diagnosis_runs_user_id_idx ON public.diagnosis_runs USING btree (user_id);


--
-- Name: idx_ai_briefing_logs_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_briefing_logs_store ON public.ai_briefing_logs USING btree (store_id);


--
-- Name: idx_ai_reports_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_reports_store_id ON public.ai_reports USING btree (store_id);


--
-- Name: idx_events_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_store_created ON public.events USING btree (store_id, created_at DESC);


--
-- Name: idx_events_table_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_table_created ON public.events USING btree (table_id, created_at DESC);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_store_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_store_customer ON public.orders USING btree (store_id, customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_orders_store_table_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_store_table_created ON public.orders USING btree (store_id, table_id, created_at DESC);


--
-- Name: idx_sessions_store_table_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_store_table_started ON public.sessions USING btree (store_id, table_id, started_at DESC);


--
-- Name: idx_store_analytics_profile_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_analytics_profile_store_id ON public.store_analytics_profile USING btree (store_id);


--
-- Name: idx_store_daily_metrics_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_daily_metrics_store_date ON public.store_daily_metrics USING btree (store_id, metric_date DESC);


--
-- Name: idx_store_home_content_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_home_content_store_id ON public.store_home_content USING btree (store_id);


--
-- Name: idx_store_priority_settings_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_priority_settings_store_id ON public.store_priority_settings USING btree (store_id);


--
-- Name: idx_store_tables_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_tables_store_status ON public.store_tables USING btree (store_id, status);


--
-- Name: inquiries_store_customer_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_store_customer_created_idx ON public.inquiries USING btree (store_id, customer_id, created_at);


--
-- Name: job_confirmations_job_revision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_confirmations_job_revision_idx ON public.job_confirmations USING btree (job_id, evidence_revision, confirmed_at DESC);


--
-- Name: job_evidence_assets_job_revision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_evidence_assets_job_revision_idx ON public.job_evidence_assets USING btree (job_id, revision_number, evidence_type);


--
-- Name: lead_capture_requests_owner_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_capture_requests_owner_profile_idx ON public.lead_capture_requests USING btree (owner_profile_id, created_at DESC);


--
-- Name: lead_capture_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_capture_requests_status_idx ON public.lead_capture_requests USING btree (status, created_at DESC);


--
-- Name: lead_capture_requests_store_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_capture_requests_store_idx ON public.lead_capture_requests USING btree (store_id, created_at DESC);


--
-- Name: market_requests_store_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_requests_store_idx ON public.market_requests USING btree (store_id, created_at DESC);


--
-- Name: market_snapshots_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_snapshots_lookup_idx ON public.market_snapshots USING btree (region_key, radius_m, version, created_at DESC);


--
-- Name: order_items_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_created_at_idx ON public.order_items USING btree (created_at);


--
-- Name: order_items_order_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_items_order_item_id_idx ON public.order_items USING btree (order_item_id);


--
-- Name: order_items_store_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_store_customer_idx ON public.order_items USING btree (store_id, customer_id);


--
-- Name: order_items_store_item_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_store_item_name_idx ON public.order_items USING btree (store_id, item_name);


--
-- Name: order_items_store_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_store_order_idx ON public.order_items USING btree (store_id, order_id);


--
-- Name: order_items_store_order_text_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_store_order_text_idx ON public.order_items USING btree (store_id, order_id_text);


--
-- Name: order_items_store_source_order_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_store_source_order_key_idx ON public.order_items USING btree (store_id, source_order_key);


--
-- Name: orders_store_payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_store_payment_status_idx ON public.orders USING btree (store_id, payment_status, created_at DESC);


--
-- Name: payment_events_event_id_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_events_event_id_uniq ON public.payment_events USING btree (provider, event_id);


--
-- Name: payment_events_provider_eventid_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_events_provider_eventid_uniq ON public.payment_events USING btree (provider, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: platform_admin_members_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_admin_members_profile_idx ON public.platform_admin_members USING btree (profile_id, status);


--
-- Name: platform_announcements_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_announcements_public_idx ON public.platform_announcements USING btree (is_published, is_pinned, starts_at, ends_at);


--
-- Name: platform_audit_logs_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_audit_logs_created_idx ON public.platform_audit_logs USING btree (created_at DESC);


--
-- Name: platform_banners_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_banners_public_idx ON public.platform_banners USING btree (is_active, priority);


--
-- Name: platform_billing_products_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_billing_products_code_idx ON public.platform_billing_products USING btree (product_code);


--
-- Name: platform_board_posts_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_board_posts_public_idx ON public.platform_board_posts USING btree (status, is_pinned, published_at);


--
-- Name: platform_content_versions_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_content_versions_entity_idx ON public.platform_content_versions USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: platform_faq_items_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_faq_items_public_idx ON public.platform_faq_items USING btree (is_published, sort_order);


--
-- Name: platform_homepage_sections_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_homepage_sections_public_idx ON public.platform_homepage_sections USING btree (status, is_visible, sort_order);


--
-- Name: platform_page_sections_page_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_page_sections_page_idx ON public.platform_page_sections USING btree (page_slug, status, sort_order);


--
-- Name: platform_pages_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_pages_slug_idx ON public.platform_pages USING btree (slug, is_published);


--
-- Name: platform_popups_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_popups_public_idx ON public.platform_popups USING btree (status, is_active, priority);


--
-- Name: platform_pricing_plans_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_pricing_plans_public_idx ON public.platform_pricing_plans USING btree (status, is_visible, sort_order);


--
-- Name: platform_site_snapshots_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_site_snapshots_status_idx ON public.platform_site_snapshots USING btree (status, created_at DESC);


--
-- Name: platform_trust_signals_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_trust_signals_public_idx ON public.platform_trust_signals USING btree (is_visible, sort_order);


--
-- Name: review_request_links_public_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX review_request_links_public_token_idx ON public.review_request_links USING btree (public_token) WHERE (public_token IS NOT NULL);


--
-- Name: review_request_links_store_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_request_links_store_created_idx ON public.review_request_links USING btree (store_id, created_at DESC);


--
-- Name: review_request_links_store_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_request_links_store_source_idx ON public.review_request_links USING btree (store_id, source_type, source_id);


--
-- Name: service_jobs_store_state_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_jobs_store_state_created_idx ON public.service_jobs USING btree (store_id, state, created_at DESC);


--
-- Name: social_accounts_store_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_accounts_store_provider_idx ON public.social_accounts USING btree (store_id, provider);


--
-- Name: social_publish_jobs_store_provider_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_publish_jobs_store_provider_status_created_idx ON public.social_publish_jobs USING btree (store_id, provider, status, created_at DESC);


--
-- Name: store_analytics_profiles_store_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_profiles_store_idx ON public.store_analytics_profiles USING btree (store_id);


--
-- Name: store_blog_posts_store_status_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_blog_posts_store_status_published_idx ON public.store_blog_posts USING btree (store_id, status, published_at DESC);


--
-- Name: store_media_assets_store_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_media_assets_store_status_created_idx ON public.store_media_assets USING btree (store_id, status, created_at DESC);


--
-- Name: store_members_profile_store_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_members_profile_store_idx ON public.store_members USING btree (profile_id, store_id);


--
-- Name: store_reviews_store_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_reviews_store_status_created_idx ON public.store_reviews USING btree (store_id, visibility_status, created_at DESC);


--
-- Name: store_setup_requests_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_setup_requests_email_idx ON public.store_setup_requests USING btree (email);


--
-- Name: store_setup_requests_requested_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_setup_requests_requested_slug_idx ON public.store_setup_requests USING btree (requested_slug);


--
-- Name: store_subscriptions_store_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_subscriptions_store_id_idx ON public.store_subscriptions USING btree (store_id);


--
-- Name: stores_slug_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stores_slug_uniq ON public.stores USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: subscriptions_billing_key_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscriptions_billing_key_uniq ON public.subscriptions USING btree (billing_key) WHERE (billing_key IS NOT NULL);


--
-- Name: subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);


--
-- Name: subscriptions_user_id_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscriptions_user_id_uniq ON public.subscriptions USING btree (user_id);


--
-- Name: ux_events_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_events_dedupe ON public.events USING btree (store_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: memberships core_memberships_set_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER core_memberships_set_updated_at BEFORE UPDATE ON core.memberships FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: organizations core_organizations_set_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER core_organizations_set_updated_at BEFORE UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: profiles core_profiles_set_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER core_profiles_set_updated_at BEFORE UPDATE ON core.profiles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: content_candidates enforce_content_candidate_terminal_state_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_content_candidate_terminal_state_before_write BEFORE INSERT OR UPDATE ON public.content_candidates FOR EACH ROW EXECUTE FUNCTION private.enforce_content_candidate_terminal_state();


--
-- Name: brand_site_portfolio_items enforce_portfolio_publication_eligibility_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_portfolio_publication_eligibility_before_write BEFORE INSERT OR UPDATE ON public.brand_site_portfolio_items FOR EACH ROW EXECUTE FUNCTION private.enforce_portfolio_publication_eligibility();


--
-- Name: service_jobs initialize_job_evidence_revision_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER initialize_job_evidence_revision_after_insert AFTER INSERT ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION private.initialize_job_evidence_revision();


--
-- Name: review_request_links review_request_links_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER review_request_links_set_updated_at BEFORE UPDATE ON public.review_request_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_capture_requests trg_lead_capture_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lead_capture_requests_set_updated_at BEFORE UPDATE ON public.lead_capture_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_accounts trg_social_accounts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_social_accounts_set_updated_at BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_publish_jobs trg_social_publish_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_social_publish_jobs_set_updated_at BEFORE UPDATE ON public.social_publish_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: store_analytics_profiles trg_store_analytics_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_analytics_profiles_set_updated_at BEFORE UPDATE ON public.store_analytics_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: store_blog_posts trg_store_blog_posts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_blog_posts_set_updated_at BEFORE UPDATE ON public.store_blog_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: store_media_assets trg_store_media_assets_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_media_assets_set_updated_at BEFORE UPDATE ON public.store_media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: store_oauth_credentials trg_store_oauth_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_oauth_credentials_updated_at BEFORE UPDATE ON public.store_oauth_credentials FOR EACH ROW EXECUTE FUNCTION public.update_store_oauth_credentials_updated_at();


--
-- Name: store_reviews trg_store_reviews_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_reviews_set_updated_at BEFORE UPDATE ON public.store_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: store_subscriptions trg_store_subscriptions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_subscriptions_set_updated_at BEFORE UPDATE ON public.store_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: memberships memberships_organization_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES core.organizations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_profile_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES core.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_default_organization_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profiles
    ADD CONSTRAINT profiles_default_organization_id_fkey FOREIGN KEY (default_organization_id) REFERENCES core.organizations(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profile_auth_bindings profile_auth_bindings_auth_profile_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.profile_auth_bindings
    ADD CONSTRAINT profile_auth_bindings_auth_profile_id_fkey FOREIGN KEY (auth_profile_id) REFERENCES core.profiles(id) ON DELETE RESTRICT;


--
-- Name: profile_auth_bindings profile_auth_bindings_public_profile_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.profile_auth_bindings
    ADD CONSTRAINT profile_auth_bindings_public_profile_id_fkey FOREIGN KEY (public_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: store_provisioning_receipts store_provisioning_receipts_actor_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.store_provisioning_receipts
    ADD CONSTRAINT store_provisioning_receipts_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);


--
-- Name: store_provisioning_receipts store_provisioning_receipts_store_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.store_provisioning_receipts
    ADD CONSTRAINT store_provisioning_receipts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id);


--
-- Name: brand_site_portfolio_items brand_site_portfolio_items_brand_site_id_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_site_portfolio_items
    ADD CONSTRAINT brand_site_portfolio_items_brand_site_id_store_id_fkey FOREIGN KEY (brand_site_id, store_id) REFERENCES public.brand_sites(id, store_id) ON DELETE CASCADE;


--
-- Name: brand_site_portfolio_items brand_site_portfolio_items_content_candidate_id_job_id_evi_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_site_portfolio_items
    ADD CONSTRAINT brand_site_portfolio_items_content_candidate_id_job_id_evi_fkey FOREIGN KEY (content_candidate_id, job_id, evidence_revision, store_id) REFERENCES public.content_candidates(id, job_id, evidence_revision, store_id);


--
-- Name: brand_site_portfolio_items brand_site_portfolio_items_job_id_evidence_revision_store__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_site_portfolio_items
    ADD CONSTRAINT brand_site_portfolio_items_job_id_evidence_revision_store__fkey FOREIGN KEY (job_id, evidence_revision, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: brand_site_portfolio_items brand_site_portfolio_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_site_portfolio_items
    ADD CONSTRAINT brand_site_portfolio_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: brand_sites brand_sites_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_sites
    ADD CONSTRAINT brand_sites_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: consent_records consent_records_job_id_evidence_revision_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_job_id_evidence_revision_store_id_fkey FOREIGN KEY (job_id, evidence_revision, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: consent_records consent_records_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: content_candidates content_candidates_job_id_evidence_revision_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_candidates
    ADD CONSTRAINT content_candidates_job_id_evidence_revision_store_id_fkey FOREIGN KEY (job_id, evidence_revision, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: content_candidates content_candidates_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_candidates
    ADD CONSTRAINT content_candidates_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_conversation_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_session_id_fkey FOREIGN KEY (conversation_session_id) REFERENCES public.conversation_sessions(id) ON DELETE CASCADE;


--
-- Name: conversation_sessions conversation_sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: conversation_sessions conversation_sessions_visitor_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_visitor_session_id_fkey FOREIGN KEY (visitor_session_id) REFERENCES public.visitor_sessions(id) ON DELETE SET NULL;


--
-- Name: customer_contacts customer_contacts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: customer_preferences customer_preferences_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: customer_timeline_events customer_timeline_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_timeline_events
    ADD CONSTRAINT customer_timeline_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: customer_timeline_events customer_timeline_events_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_timeline_events
    ADD CONSTRAINT customer_timeline_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: customers customers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: events events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: events events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id) ON DELETE SET NULL;


--
-- Name: events events_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: events events_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.store_tables(table_id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_conversation_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_conversation_session_id_fkey FOREIGN KEY (conversation_session_id) REFERENCES public.conversation_sessions(id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: inquiries inquiries_visitor_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_visitor_session_id_fkey FOREIGN KEY (visitor_session_id) REFERENCES public.visitor_sessions(id) ON DELETE SET NULL;


--
-- Name: job_confirmation_links job_confirmation_links_job_id_evidence_revision_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmation_links
    ADD CONSTRAINT job_confirmation_links_job_id_evidence_revision_store_id_fkey FOREIGN KEY (job_id, evidence_revision, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: job_confirmation_links job_confirmation_links_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmation_links
    ADD CONSTRAINT job_confirmation_links_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: job_confirmations job_confirmations_job_id_evidence_revision_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmations
    ADD CONSTRAINT job_confirmations_job_id_evidence_revision_store_id_fkey FOREIGN KEY (job_id, evidence_revision, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: job_confirmations job_confirmations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_confirmations
    ADD CONSTRAINT job_confirmations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: job_evidence_assets job_evidence_assets_job_id_revision_number_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_job_id_revision_number_store_id_fkey FOREIGN KEY (job_id, revision_number, store_id) REFERENCES public.job_evidence_revisions(job_id, revision_number, store_id);


--
-- Name: job_evidence_assets job_evidence_assets_job_id_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_job_id_store_id_fkey FOREIGN KEY (job_id, store_id) REFERENCES public.service_jobs(id, store_id) ON DELETE CASCADE;


--
-- Name: job_evidence_assets job_evidence_assets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: job_evidence_assets job_evidence_assets_uploader_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_assets
    ADD CONSTRAINT job_evidence_assets_uploader_user_id_fkey FOREIGN KEY (uploader_user_id) REFERENCES public.profiles(id);


--
-- Name: job_evidence_revisions job_evidence_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: job_evidence_revisions job_evidence_revisions_job_id_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_job_id_store_id_fkey FOREIGN KEY (job_id, store_id) REFERENCES public.service_jobs(id, store_id) ON DELETE CASCADE;


--
-- Name: job_evidence_revisions job_evidence_revisions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_evidence_revisions
    ADD CONSTRAINT job_evidence_revisions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: job_payment_requests job_payment_requests_job_id_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_payment_requests
    ADD CONSTRAINT job_payment_requests_job_id_store_id_fkey FOREIGN KEY (job_id, store_id) REFERENCES public.service_jobs(id, store_id) ON DELETE CASCADE;


--
-- Name: job_payment_requests job_payment_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_payment_requests
    ADD CONSTRAINT job_payment_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: lead_capture_requests lead_capture_requests_owner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_capture_requests
    ADD CONSTRAINT lead_capture_requests_owner_profile_id_fkey FOREIGN KEY (owner_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: lead_capture_requests lead_capture_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_capture_requests
    ADD CONSTRAINT lead_capture_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE SET NULL;


--
-- Name: market_requests market_requests_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_requests
    ADD CONSTRAINT market_requests_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.market_snapshots(id);


--
-- Name: menu_categories menu_categories_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(category_id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: orders orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id) ON DELETE RESTRICT;


--
-- Name: orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.store_tables(table_id) ON DELETE RESTRICT;


--
-- Name: platform_admin_members platform_admin_members_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_members
    ADD CONSTRAINT platform_admin_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_admin_members platform_admin_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_members
    ADD CONSTRAINT platform_admin_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: platform_announcements platform_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_announcements
    ADD CONSTRAINT platform_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_announcements platform_announcements_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_announcements
    ADD CONSTRAINT platform_announcements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_audit_logs platform_audit_logs_actor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_billing_products platform_billing_products_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_billing_products
    ADD CONSTRAINT platform_billing_products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_board_posts platform_board_posts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_board_posts
    ADD CONSTRAINT platform_board_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_board_posts platform_board_posts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_board_posts
    ADD CONSTRAINT platform_board_posts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_content_versions platform_content_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_content_versions
    ADD CONSTRAINT platform_content_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_faq_items platform_faq_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_faq_items
    ADD CONSTRAINT platform_faq_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_feature_flags platform_feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_footer_settings platform_footer_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_footer_settings
    ADD CONSTRAINT platform_footer_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_homepage_sections platform_homepage_sections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_homepage_sections
    ADD CONSTRAINT platform_homepage_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_media_assets platform_media_assets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_media_assets
    ADD CONSTRAINT platform_media_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_page_sections platform_page_sections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_page_sections
    ADD CONSTRAINT platform_page_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_pages platform_pages_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages
    ADD CONSTRAINT platform_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_popups platform_popups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_popups
    ADD CONSTRAINT platform_popups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_popups platform_popups_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_popups
    ADD CONSTRAINT platform_popups_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_pricing_plans platform_pricing_plans_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pricing_plans
    ADD CONSTRAINT platform_pricing_plans_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_site_settings platform_site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_site_settings
    ADD CONSTRAINT platform_site_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_site_snapshots platform_site_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_site_snapshots
    ADD CONSTRAINT platform_site_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: platform_trust_signals platform_trust_signals_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_trust_signals
    ADD CONSTRAINT platform_trust_signals_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: reservations reservations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: reservations reservations_visitor_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_visitor_session_id_fkey FOREIGN KEY (visitor_session_id) REFERENCES public.visitor_sessions(id) ON DELETE SET NULL;


--
-- Name: review_request_links review_request_links_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_links
    ADD CONSTRAINT review_request_links_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: service_jobs service_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_jobs
    ADD CONSTRAINT service_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: service_jobs service_jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_jobs
    ADD CONSTRAINT service_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: service_jobs service_jobs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_jobs
    ADD CONSTRAINT service_jobs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: sessions sessions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE RESTRICT;


--
-- Name: sessions sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: sessions sessions_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.store_tables(table_id) ON DELETE RESTRICT;


--
-- Name: social_accounts social_accounts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: social_publish_jobs social_publish_jobs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publish_jobs
    ADD CONSTRAINT social_publish_jobs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_analytics_profiles store_analytics_profiles_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_profiles
    ADD CONSTRAINT store_analytics_profiles_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_blog_posts store_blog_posts_source_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_blog_posts
    ADD CONSTRAINT store_blog_posts_source_review_id_fkey FOREIGN KEY (source_review_id) REFERENCES public.store_reviews(review_id) ON DELETE SET NULL;


--
-- Name: store_blog_posts store_blog_posts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_blog_posts
    ADD CONSTRAINT store_blog_posts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_media_assets store_media_assets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_media_assets
    ADD CONSTRAINT store_media_assets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_members store_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_members
    ADD CONSTRAINT store_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: store_members store_members_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_members
    ADD CONSTRAINT store_members_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_modules store_modules_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_modules
    ADD CONSTRAINT store_modules_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_public_pages store_public_pages_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_public_pages
    ADD CONSTRAINT store_public_pages_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_reviews store_reviews_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reviews
    ADD CONSTRAINT store_reviews_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_setup_requests store_setup_requests_converted_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_setup_requests
    ADD CONSTRAINT store_setup_requests_converted_store_id_fkey FOREIGN KEY (converted_store_id) REFERENCES public.stores(store_id) ON DELETE SET NULL;


--
-- Name: store_staff store_staff_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_staff
    ADD CONSTRAINT store_staff_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_subscriptions store_subscriptions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_subscriptions
    ADD CONSTRAINT store_subscriptions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_tables store_tables_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_tables
    ADD CONSTRAINT store_tables_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: visitor_sessions visitor_sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: waiting_entries waiting_entries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_entries
    ADD CONSTRAINT waiting_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE SET NULL;


--
-- Name: waiting_entries waiting_entries_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_entries
    ADD CONSTRAINT waiting_entries_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: waiting_entries waiting_entries_visitor_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_entries
    ADD CONSTRAINT waiting_entries_visitor_session_id_fkey FOREIGN KEY (visitor_session_id) REFERENCES public.visitor_sessions(id) ON DELETE SET NULL;


--
-- Name: commercial_submissions; Type: ROW SECURITY; Schema: biz2lab; Owner: -
--

ALTER TABLE biz2lab.commercial_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships memberships_admin_manage; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY memberships_admin_manage ON core.memberships TO authenticated USING (core.has_org_role(organization_id, ARRAY['owner'::core.membership_role, 'admin'::core.membership_role])) WITH CHECK (core.has_org_role(organization_id, ARRAY['owner'::core.membership_role, 'admin'::core.membership_role]));


--
-- Name: memberships memberships_select_member; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY memberships_select_member ON core.memberships FOR SELECT TO authenticated USING (core.has_org_access(organization_id));


--
-- Name: organizations; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_select_member; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY organizations_select_member ON core.organizations FOR SELECT TO authenticated USING (core.has_org_access(id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_self; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY profiles_insert_self ON core.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles_select_self; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY profiles_select_self ON core.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles profiles_update_self; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY profiles_update_self ON core.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profile_auth_bindings; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.profile_auth_bindings ENABLE ROW LEVEL SECURITY;

--
-- Name: store_provisioning_receipts; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.store_provisioning_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: market_requests Allow all for development; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for development" ON public.market_requests USING (true) WITH CHECK (true);


--
-- Name: market_snapshots Allow all for development; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for development" ON public.market_snapshots USING (true) WITH CHECK (true);


--
-- Name: ai_briefing_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_briefing_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosis_runs block_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_all ON public.diagnosis_runs USING (false) WITH CHECK (false);


--
-- Name: payment_events block_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_all ON public.payment_events USING (false) WITH CHECK (false);


--
-- Name: subscriptions block_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_all ON public.subscriptions USING (false) WITH CHECK (false);


--
-- Name: brand_site_portfolio_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_site_portfolio_items ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_sites brand_sites_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_sites_member_select ON public.brand_sites FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: job_confirmations confirmations_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY confirmations_member_select ON public.job_confirmations FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: consent_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_records consent_records_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_records_member_select ON public.consent_records FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: content_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: content_candidates content_candidates_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_candidates_member_select ON public.content_candidates FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages conversation_messages_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_messages_member_access ON public.conversation_messages USING ((EXISTS ( SELECT 1
   FROM public.conversation_sessions cs
  WHERE ((cs.id = conversation_messages.conversation_session_id) AND public.is_store_member(cs.store_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_sessions cs
  WHERE ((cs.id = conversation_messages.conversation_session_id) AND public.is_store_member(cs.store_id)))));


--
-- Name: conversation_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_sessions conversation_sessions_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_sessions_member_access ON public.conversation_sessions USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: customer_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_contacts customer_contacts_insert_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_contacts_insert_store_member ON public.customer_contacts FOR INSERT TO authenticated WITH CHECK (((store_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_contacts.customer_id) AND (c.store_id = customer_contacts.store_id) AND public.is_store_member(c.store_id))))));


--
-- Name: customer_contacts customer_contacts_select_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_contacts_select_store_member ON public.customer_contacts FOR SELECT TO authenticated USING (((store_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_contacts.customer_id) AND (c.store_id = customer_contacts.store_id) AND public.is_store_member(c.store_id))))));


--
-- Name: customer_contacts customer_contacts_update_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_contacts_update_store_member ON public.customer_contacts FOR UPDATE TO authenticated USING (((store_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_contacts.customer_id) AND (c.store_id = customer_contacts.store_id) AND public.is_store_member(c.store_id)))))) WITH CHECK (((store_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_contacts.customer_id) AND (c.store_id = customer_contacts.store_id) AND public.is_store_member(c.store_id))))));


--
-- Name: customer_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_preferences customer_preferences_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_preferences_member_access ON public.customer_preferences USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_preferences.customer_id) AND public.is_store_member(c.store_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_preferences.customer_id) AND public.is_store_member(c.store_id)))));


--
-- Name: customer_recommendation_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_recommendation_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_timeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_timeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_timeline_events customer_timeline_events_insert_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_timeline_events_insert_store_member ON public.customer_timeline_events FOR INSERT TO authenticated WITH CHECK ((public.is_store_member(store_id) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_timeline_events.customer_id) AND (c.store_id = customer_timeline_events.store_id))))));


--
-- Name: customer_timeline_events customer_timeline_events_select_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_timeline_events_select_store_member ON public.customer_timeline_events FOR SELECT TO authenticated USING (public.is_store_member(store_id));


--
-- Name: customer_timeline_events customer_timeline_events_update_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_timeline_events_update_store_member ON public.customer_timeline_events FOR UPDATE TO authenticated USING (public.is_store_member(store_id)) WITH CHECK ((public.is_store_member(store_id) AND (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = customer_timeline_events.customer_id) AND (c.store_id = customer_timeline_events.store_id))))));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_insert_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_insert_store_member ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_store_member(store_id));


--
-- Name: customers customers_select_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_store_member ON public.customers FOR SELECT TO authenticated USING (public.is_store_member(store_id));


--
-- Name: customers customers_update_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_update_store_member ON public.customers FOR UPDATE TO authenticated USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: diagnosis_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosis_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: job_evidence_assets evidence_assets_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_assets_member_select ON public.job_evidence_assets FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: job_evidence_revisions evidence_revisions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_revisions_member_select ON public.job_evidence_revisions FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: inquiries inquiries_insert_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_insert_store_member ON public.inquiries FOR INSERT TO authenticated WITH CHECK ((public.is_store_member(store_id) AND ((customer_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = inquiries.customer_id) AND (c.store_id = inquiries.store_id)))))));


--
-- Name: inquiries inquiries_select_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_select_store_member ON public.inquiries FOR SELECT TO authenticated USING (public.is_store_member(store_id));


--
-- Name: inquiries inquiries_update_store_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_update_store_member ON public.inquiries FOR UPDATE TO authenticated USING (public.is_store_member(store_id)) WITH CHECK ((public.is_store_member(store_id) AND ((customer_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.customer_id = inquiries.customer_id) AND (c.store_id = inquiries.store_id)))))));


--
-- Name: job_confirmation_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_confirmation_links ENABLE ROW LEVEL SECURITY;

--
-- Name: job_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: job_evidence_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_evidence_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: job_evidence_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_evidence_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: job_payment_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_payment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_capture_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_capture_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_capture_requests lead_capture_requests_platform_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_capture_requests_platform_admin_insert ON public.lead_capture_requests FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.platform_admin_members pam
  WHERE ((pam.profile_id = auth.uid()) AND (pam.role = ANY (ARRAY['platform_owner'::text, 'platform_admin'::text]))))));


--
-- Name: lead_capture_requests lead_capture_requests_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_capture_requests_platform_admin_select ON public.lead_capture_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.platform_admin_members pam
  WHERE ((pam.profile_id = auth.uid()) AND (pam.role = ANY (ARRAY['platform_owner'::text, 'platform_admin'::text]))))));


--
-- Name: lead_capture_requests lead_capture_requests_platform_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_capture_requests_platform_admin_update ON public.lead_capture_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.platform_admin_members pam
  WHERE ((pam.profile_id = auth.uid()) AND (pam.role = ANY (ARRAY['platform_owner'::text, 'platform_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.platform_admin_members pam
  WHERE ((pam.profile_id = auth.uid()) AND (pam.role = ANY (ARRAY['platform_owner'::text, 'platform_admin'::text]))))));


--
-- Name: lead_capture_requests lead_capture_requests_store_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_capture_requests_store_member_select ON public.lead_capture_requests FOR SELECT TO authenticated USING (((store_id IS NOT NULL) AND public.is_store_member(store_id)));


--
-- Name: lead_capture_requests lead_capture_requests_store_member_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_capture_requests_store_member_update ON public.lead_capture_requests FOR UPDATE TO authenticated USING (((store_id IS NOT NULL) AND public.is_store_member(store_id))) WITH CHECK (((store_id IS NOT NULL) AND public.is_store_member(store_id)));


--
-- Name: market_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.market_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: market_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories mybiz_categories_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_categories_member_insert ON public.menu_categories FOR INSERT TO authenticated WITH CHECK (private.is_service_os_store_member(store_id));


--
-- Name: menu_categories mybiz_categories_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_categories_member_select ON public.menu_categories FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: menu_items mybiz_items_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_items_member_insert ON public.menu_items FOR INSERT TO authenticated WITH CHECK (private.is_service_os_store_member(store_id));


--
-- Name: menu_items mybiz_items_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_items_member_select ON public.menu_items FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: store_priority_settings mybiz_priority_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_priority_member_insert ON public.store_priority_settings FOR INSERT TO authenticated WITH CHECK (
CASE
    WHEN (store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) THEN private.is_service_os_store_member((store_id)::uuid)
    ELSE false
END);


--
-- Name: store_priority_settings mybiz_priority_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_priority_member_select ON public.store_priority_settings FOR SELECT TO authenticated USING (
CASE
    WHEN (store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) THEN private.is_service_os_store_member((store_id)::uuid)
    ELSE false
END);


--
-- Name: store_priority_settings mybiz_priority_member_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_priority_member_update ON public.store_priority_settings FOR UPDATE TO authenticated USING (
CASE
    WHEN (store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) THEN private.is_service_os_store_member((store_id)::uuid)
    ELSE false
END) WITH CHECK (
CASE
    WHEN (store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) THEN private.is_service_os_store_member((store_id)::uuid)
    ELSE false
END);


--
-- Name: store_tables mybiz_tables_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_tables_member_insert ON public.store_tables FOR INSERT TO authenticated WITH CHECK (private.is_service_os_store_member(store_id));


--
-- Name: store_tables mybiz_tables_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mybiz_tables_member_select ON public.store_tables FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_member_access ON public.order_items USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: job_payment_requests payment_requests_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_requests_member_select ON public.job_payment_requests FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: platform_admin_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admin_members ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_billing_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_billing_products ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_board_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_board_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_content_quality_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_content_quality_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_content_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_content_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_effect_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_effect_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_faq_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_faq_items ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_footer_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_footer_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_homepage_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_homepage_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_page_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_page_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_popups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_popups ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_pricing_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_pricing_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_site_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_site_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_trust_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_trust_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_site_portfolio_items portfolio_items_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_items_member_select ON public.brand_site_portfolio_items FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations reservations_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_member_access ON public.reservations USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: review_request_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_request_links ENABLE ROW LEVEL SECURITY;

--
-- Name: review_request_links review_request_links_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY review_request_links_member_access ON public.review_request_links USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_oauth_credentials service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.store_oauth_credentials USING (true) WITH CHECK (true);


--
-- Name: service_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: service_jobs service_jobs_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_jobs_member_select ON public.service_jobs FOR SELECT TO authenticated USING (private.is_service_os_store_member(store_id));


--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: store_setup_requests setup_requests_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY setup_requests_select_own ON public.store_setup_requests FOR SELECT USING ((auth.uid() = created_by));


--
-- Name: store_setup_requests setup_requests_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY setup_requests_update_own ON public.store_setup_requests FOR UPDATE USING ((auth.uid() = created_by)) WITH CHECK ((auth.uid() = created_by));


--
-- Name: social_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: social_accounts social_accounts_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY social_accounts_member_access ON public.social_accounts USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: social_publish_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: social_publish_jobs social_publish_jobs_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY social_publish_jobs_member_access ON public.social_publish_jobs USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: customer_recommendation_actions store members can insert recommendation actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "store members can insert recommendation actions" ON public.customer_recommendation_actions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.store_members sm
  WHERE ((sm.store_id = customer_recommendation_actions.store_id) AND (sm.profile_id = auth.uid())))));


--
-- Name: customer_recommendation_actions store members can read recommendation actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "store members can read recommendation actions" ON public.customer_recommendation_actions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.store_members sm
  WHERE ((sm.store_id = customer_recommendation_actions.store_id) AND (sm.profile_id = auth.uid())))));


--
-- Name: customer_recommendation_actions store members can update recommendation actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "store members can update recommendation actions" ON public.customer_recommendation_actions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.store_members sm
  WHERE ((sm.store_id = customer_recommendation_actions.store_id) AND (sm.profile_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.store_members sm
  WHERE ((sm.store_id = customer_recommendation_actions.store_id) AND (sm.profile_id = auth.uid())))));


--
-- Name: store_analytics_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: store_analytics_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: store_analytics_profiles store_analytics_profiles_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_analytics_profiles_member_access ON public.store_analytics_profiles USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: store_blog_posts store_blog_posts_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_blog_posts_member_access ON public.store_blog_posts USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_blog_posts store_blog_posts_public_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_blog_posts_public_read_published ON public.store_blog_posts FOR SELECT USING ((status = 'published'::text));


--
-- Name: store_daily_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_daily_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: store_home_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_home_content ENABLE ROW LEVEL SECURITY;

--
-- Name: store_media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: store_media_assets store_media_assets_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_media_assets_member_access ON public.store_media_assets USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_media_assets store_media_assets_public_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_media_assets_public_read_published ON public.store_media_assets FOR SELECT USING ((status = 'published'::text));


--
-- Name: store_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

--
-- Name: store_members store_members_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_members_insert_member ON public.store_members FOR INSERT WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_members store_members_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_members_select_member ON public.store_members FOR SELECT USING (public.is_store_member(store_id));


--
-- Name: store_members store_members_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_members_update_member ON public.store_members FOR UPDATE USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: store_oauth_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_oauth_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: store_priority_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_priority_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: store_public_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_public_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: store_public_pages store_public_pages_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_public_pages_member_access ON public.store_public_pages USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: store_reviews store_reviews_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_reviews_member_access ON public.store_reviews USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_setup_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_setup_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: store_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: store_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: store_subscriptions store_subscriptions_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_subscriptions_member_access ON public.store_subscriptions USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: store_tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: stores stores_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stores_member_access ON public.stores USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: vertical_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vertical_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: vertical_templates vertical_templates_public_v1_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vertical_templates_public_v1_select ON public.vertical_templates FOR SELECT TO authenticated USING ((public_v1 AND (NOT medical_mode) AND (id = ANY (ARRAY['cleaning'::text, 'hair'::text, 'installation'::text]))));


--
-- Name: visitor_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: waiting_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waiting_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: waiting_entries waiting_entries_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waiting_entries_member_access ON public.waiting_entries USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));


--
-- Name: SCHEMA core; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA core TO authenticated;


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO service_role;
GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--



--
-- Name: FUNCTION create_organization_with_owner(p_name text, p_slug text); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.create_organization_with_owner(p_name text, p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION core.create_organization_with_owner(p_name text, p_slug text) TO authenticated;


--
-- Name: FUNCTION handle_auth_user_created(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.handle_auth_user_created() FROM PUBLIC;


--
-- Name: FUNCTION consume_job_confirmation_link(p_token_hash text, p_outcome text, p_actor_label text, p_metadata jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.consume_job_confirmation_link(p_token_hash text, p_outcome text, p_actor_label text, p_metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.consume_job_confirmation_link(p_token_hash text, p_outcome text, p_actor_label text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION create_next_job_evidence_revision(p_job_id uuid, p_actor_id uuid, p_reason text); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.create_next_job_evidence_revision(p_job_id uuid, p_actor_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.create_next_job_evidence_revision(p_job_id uuid, p_actor_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION current_service_os_business_profile_id(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.current_service_os_business_profile_id() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_service_os_business_profile_id() TO authenticated;


--
-- Name: FUNCTION enforce_content_candidate_terminal_state(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.enforce_content_candidate_terminal_state() FROM PUBLIC;


--
-- Name: FUNCTION enforce_portfolio_publication_eligibility(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.enforce_portfolio_publication_eligibility() FROM PUBLIC;


--
-- Name: FUNCTION initialize_job_evidence_revision(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.initialize_job_evidence_revision() FROM PUBLIC;


--
-- Name: FUNCTION is_service_os_publication_eligible(p_store_id uuid, p_job_id uuid, p_revision integer, p_channel text, p_merchant_approved_at timestamp with time zone); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_service_os_publication_eligible(p_store_id uuid, p_job_id uuid, p_revision integer, p_channel text, p_merchant_approved_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_service_os_publication_eligible(p_store_id uuid, p_job_id uuid, p_revision integer, p_channel text, p_merchant_approved_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION is_service_os_store_member(target_store_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_service_os_store_member(target_store_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_service_os_store_member(target_store_id uuid) TO authenticated;


--
-- Name: FUNCTION biz2lab_commercial_delete_submission(p_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.biz2lab_commercial_delete_submission(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.biz2lab_commercial_delete_submission(p_id bigint) TO service_role;


--
-- Name: FUNCTION biz2lab_commercial_expired_ids(p_cutoff timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.biz2lab_commercial_expired_ids(p_cutoff timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.biz2lab_commercial_expired_ids(p_cutoff timestamp with time zone) TO service_role;


--
-- Name: FUNCTION biz2lab_commercial_insert_submission(p_kind text, p_service text, p_email text, p_name text, p_message text, p_source text, p_landing_url text, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_consented_at timestamp with time zone, p_created_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.biz2lab_commercial_insert_submission(p_kind text, p_service text, p_email text, p_name text, p_message text, p_source text, p_landing_url text, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_consented_at timestamp with time zone, p_created_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.biz2lab_commercial_insert_submission(p_kind text, p_service text, p_email text, p_name text, p_message text, p_source text, p_landing_url text, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_consented_at timestamp with time zone, p_created_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION biz2lab_commercial_recent_submission_exists(p_service text, p_kind text, p_email text, p_cutoff timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.biz2lab_commercial_recent_submission_exists(p_service text, p_kind text, p_email text, p_cutoff timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.biz2lab_commercial_recent_submission_exists(p_service text, p_kind text, p_email text, p_cutoff timestamp with time zone) TO service_role;


--
-- Name: FUNCTION biz2lab_commercial_rows_by_email(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.biz2lab_commercial_rows_by_email(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.biz2lab_commercial_rows_by_email(p_email text) TO service_role;


--
-- Name: FUNCTION create_store_with_owner(p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text, p_plan text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_store_with_owner(p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text, p_plan text) FROM PUBLIC;


--
-- Name: FUNCTION generate_unique_store_slug(base_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_unique_store_slug(base_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_unique_store_slug(base_name text) TO service_role;


--
-- Name: FUNCTION get_cohort_stats(cohort_key_input text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_cohort_stats(cohort_key_input text) TO anon;
GRANT ALL ON FUNCTION public.get_cohort_stats(cohort_key_input text) TO authenticated;
GRANT ALL ON FUNCTION public.get_cohort_stats(cohort_key_input text) TO service_role;


--
-- Name: FUNCTION is_store_member(target_store_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_store_member(target_store_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_store_member(target_store_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_store_member(target_store_id uuid) TO service_role;


--
-- Name: FUNCTION provision_store_from_verified_actor(p_auth_user_id uuid, p_request_key text, p_request_hash text, p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text, p_plan text, p_payment_id text, p_payment_amount numeric, p_payment_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.provision_store_from_verified_actor(p_auth_user_id uuid, p_request_key text, p_request_hash text, p_store_name text, p_owner_name text, p_business_number text, p_phone text, p_email text, p_address text, p_business_type text, p_requested_slug text, p_plan text, p_payment_id text, p_payment_amount numeric, p_payment_currency text) FROM PUBLIC;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION slugify_store_name(input text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.slugify_store_name(input text) TO anon;
GRANT ALL ON FUNCTION public.slugify_store_name(input text) TO authenticated;
GRANT ALL ON FUNCTION public.slugify_store_name(input text) TO service_role;


--
-- Name: FUNCTION update_store_oauth_credentials_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_store_oauth_credentials_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_store_oauth_credentials_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_store_oauth_credentials_updated_at() TO service_role;


--
-- Name: TABLE memberships; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.memberships TO authenticated;


--
-- Name: TABLE organizations; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.organizations TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.profiles TO authenticated;


--
-- Name: TABLE ai_briefing_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_briefing_logs TO service_role;


--
-- Name: TABLE ai_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_reports TO service_role;


--
-- Name: TABLE brand_site_portfolio_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.brand_site_portfolio_items TO authenticated;
GRANT ALL ON TABLE public.brand_site_portfolio_items TO service_role;


--
-- Name: TABLE brand_sites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.brand_sites TO authenticated;
GRANT ALL ON TABLE public.brand_sites TO service_role;


--
-- Name: TABLE consent_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.consent_records TO authenticated;
GRANT ALL ON TABLE public.consent_records TO service_role;


--
-- Name: TABLE content_candidates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.content_candidates TO authenticated;
GRANT ALL ON TABLE public.content_candidates TO service_role;


--
-- Name: TABLE conversation_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_messages TO anon;
GRANT ALL ON TABLE public.conversation_messages TO authenticated;
GRANT ALL ON TABLE public.conversation_messages TO service_role;


--
-- Name: TABLE conversation_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_sessions TO anon;
GRANT ALL ON TABLE public.conversation_sessions TO authenticated;
GRANT ALL ON TABLE public.conversation_sessions TO service_role;


--
-- Name: TABLE customer_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.customer_contacts TO authenticated;
GRANT ALL ON TABLE public.customer_contacts TO service_role;


--
-- Name: TABLE customer_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer_preferences TO anon;
GRANT ALL ON TABLE public.customer_preferences TO authenticated;
GRANT ALL ON TABLE public.customer_preferences TO service_role;


--
-- Name: TABLE customer_recommendation_actions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer_recommendation_actions TO anon;
GRANT ALL ON TABLE public.customer_recommendation_actions TO authenticated;
GRANT ALL ON TABLE public.customer_recommendation_actions TO service_role;


--
-- Name: TABLE customer_timeline_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.customer_timeline_events TO authenticated;
GRANT ALL ON TABLE public.customer_timeline_events TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE diagnosis_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.diagnosis_runs TO anon;
GRANT ALL ON TABLE public.diagnosis_runs TO authenticated;
GRANT ALL ON TABLE public.diagnosis_runs TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.inquiries TO authenticated;
GRANT ALL ON TABLE public.inquiries TO service_role;


--
-- Name: TABLE job_confirmation_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.job_confirmation_links TO service_role;


--
-- Name: TABLE job_confirmations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.job_confirmations TO authenticated;
GRANT ALL ON TABLE public.job_confirmations TO service_role;


--
-- Name: TABLE job_evidence_assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.job_evidence_assets TO authenticated;
GRANT ALL ON TABLE public.job_evidence_assets TO service_role;


--
-- Name: TABLE job_evidence_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.job_evidence_revisions TO authenticated;
GRANT ALL ON TABLE public.job_evidence_revisions TO service_role;


--
-- Name: TABLE job_payment_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.job_payment_requests TO authenticated;
GRANT ALL ON TABLE public.job_payment_requests TO service_role;


--
-- Name: TABLE lead_capture_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.lead_capture_requests TO authenticated;
GRANT ALL ON TABLE public.lead_capture_requests TO service_role;


--
-- Name: TABLE market_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.market_requests TO anon;
GRANT ALL ON TABLE public.market_requests TO authenticated;
GRANT ALL ON TABLE public.market_requests TO service_role;


--
-- Name: TABLE market_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.market_snapshots TO anon;
GRANT ALL ON TABLE public.market_snapshots TO authenticated;
GRANT ALL ON TABLE public.market_snapshots TO service_role;


--
-- Name: TABLE menu_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.menu_categories TO service_role;
GRANT SELECT,INSERT ON TABLE public.menu_categories TO authenticated;


--
-- Name: TABLE menu_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.menu_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.menu_items TO authenticated;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: TABLE payment_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_events TO anon;
GRANT ALL ON TABLE public.payment_events TO authenticated;
GRANT ALL ON TABLE public.payment_events TO service_role;


--
-- Name: TABLE platform_admin_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_admin_members TO anon;
GRANT ALL ON TABLE public.platform_admin_members TO authenticated;
GRANT ALL ON TABLE public.platform_admin_members TO service_role;


--
-- Name: TABLE platform_announcements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_announcements TO anon;
GRANT ALL ON TABLE public.platform_announcements TO authenticated;
GRANT ALL ON TABLE public.platform_announcements TO service_role;


--
-- Name: TABLE platform_audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_audit_logs TO anon;
GRANT ALL ON TABLE public.platform_audit_logs TO authenticated;
GRANT ALL ON TABLE public.platform_audit_logs TO service_role;


--
-- Name: TABLE platform_banners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_banners TO anon;
GRANT ALL ON TABLE public.platform_banners TO authenticated;
GRANT ALL ON TABLE public.platform_banners TO service_role;


--
-- Name: TABLE platform_billing_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_billing_products TO anon;
GRANT ALL ON TABLE public.platform_billing_products TO authenticated;
GRANT ALL ON TABLE public.platform_billing_products TO service_role;


--
-- Name: TABLE platform_board_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_board_posts TO anon;
GRANT ALL ON TABLE public.platform_board_posts TO authenticated;
GRANT ALL ON TABLE public.platform_board_posts TO service_role;


--
-- Name: TABLE platform_content_quality_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_content_quality_rules TO anon;
GRANT ALL ON TABLE public.platform_content_quality_rules TO authenticated;
GRANT ALL ON TABLE public.platform_content_quality_rules TO service_role;


--
-- Name: TABLE platform_content_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_content_versions TO anon;
GRANT ALL ON TABLE public.platform_content_versions TO authenticated;
GRANT ALL ON TABLE public.platform_content_versions TO service_role;


--
-- Name: TABLE platform_effect_presets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_effect_presets TO anon;
GRANT ALL ON TABLE public.platform_effect_presets TO authenticated;
GRANT ALL ON TABLE public.platform_effect_presets TO service_role;


--
-- Name: TABLE platform_faq_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_faq_items TO anon;
GRANT ALL ON TABLE public.platform_faq_items TO authenticated;
GRANT ALL ON TABLE public.platform_faq_items TO service_role;


--
-- Name: TABLE platform_feature_flags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_feature_flags TO anon;
GRANT ALL ON TABLE public.platform_feature_flags TO authenticated;
GRANT ALL ON TABLE public.platform_feature_flags TO service_role;


--
-- Name: TABLE platform_footer_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_footer_settings TO anon;
GRANT ALL ON TABLE public.platform_footer_settings TO authenticated;
GRANT ALL ON TABLE public.platform_footer_settings TO service_role;


--
-- Name: TABLE platform_homepage_sections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_homepage_sections TO anon;
GRANT ALL ON TABLE public.platform_homepage_sections TO authenticated;
GRANT ALL ON TABLE public.platform_homepage_sections TO service_role;


--
-- Name: TABLE platform_media_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_media_assets TO anon;
GRANT ALL ON TABLE public.platform_media_assets TO authenticated;
GRANT ALL ON TABLE public.platform_media_assets TO service_role;


--
-- Name: TABLE platform_page_sections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_page_sections TO anon;
GRANT ALL ON TABLE public.platform_page_sections TO authenticated;
GRANT ALL ON TABLE public.platform_page_sections TO service_role;


--
-- Name: TABLE platform_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_pages TO anon;
GRANT ALL ON TABLE public.platform_pages TO authenticated;
GRANT ALL ON TABLE public.platform_pages TO service_role;


--
-- Name: TABLE platform_popups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_popups TO anon;
GRANT ALL ON TABLE public.platform_popups TO authenticated;
GRANT ALL ON TABLE public.platform_popups TO service_role;


--
-- Name: TABLE platform_pricing_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_pricing_plans TO anon;
GRANT ALL ON TABLE public.platform_pricing_plans TO authenticated;
GRANT ALL ON TABLE public.platform_pricing_plans TO service_role;


--
-- Name: TABLE platform_promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_promotions TO anon;
GRANT ALL ON TABLE public.platform_promotions TO authenticated;
GRANT ALL ON TABLE public.platform_promotions TO service_role;


--
-- Name: TABLE platform_site_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_site_settings TO anon;
GRANT ALL ON TABLE public.platform_site_settings TO authenticated;
GRANT ALL ON TABLE public.platform_site_settings TO service_role;


--
-- Name: TABLE platform_site_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_site_snapshots TO anon;
GRANT ALL ON TABLE public.platform_site_snapshots TO authenticated;
GRANT ALL ON TABLE public.platform_site_snapshots TO service_role;


--
-- Name: TABLE platform_trust_signals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_trust_signals TO anon;
GRANT ALL ON TABLE public.platform_trust_signals TO authenticated;
GRANT ALL ON TABLE public.platform_trust_signals TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE reservations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservations TO anon;
GRANT ALL ON TABLE public.reservations TO authenticated;
GRANT ALL ON TABLE public.reservations TO service_role;


--
-- Name: TABLE review_request_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.review_request_links TO anon;
GRANT ALL ON TABLE public.review_request_links TO authenticated;
GRANT ALL ON TABLE public.review_request_links TO service_role;


--
-- Name: TABLE service_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.service_jobs TO authenticated;
GRANT ALL ON TABLE public.service_jobs TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sessions TO service_role;


--
-- Name: TABLE social_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_accounts TO anon;
GRANT ALL ON TABLE public.social_accounts TO authenticated;
GRANT ALL ON TABLE public.social_accounts TO service_role;


--
-- Name: TABLE social_publish_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_publish_jobs TO anon;
GRANT ALL ON TABLE public.social_publish_jobs TO authenticated;
GRANT ALL ON TABLE public.social_publish_jobs TO service_role;


--
-- Name: TABLE store_analytics_profile; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_analytics_profile TO service_role;


--
-- Name: TABLE store_analytics_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_analytics_profiles TO anon;
GRANT ALL ON TABLE public.store_analytics_profiles TO authenticated;
GRANT ALL ON TABLE public.store_analytics_profiles TO service_role;


--
-- Name: TABLE store_blog_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_blog_posts TO anon;
GRANT ALL ON TABLE public.store_blog_posts TO authenticated;
GRANT ALL ON TABLE public.store_blog_posts TO service_role;


--
-- Name: TABLE store_daily_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_daily_metrics TO service_role;


--
-- Name: TABLE store_home_content; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_home_content TO service_role;


--
-- Name: TABLE store_media_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_media_assets TO anon;
GRANT ALL ON TABLE public.store_media_assets TO authenticated;
GRANT ALL ON TABLE public.store_media_assets TO service_role;


--
-- Name: TABLE store_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_members TO anon;
GRANT ALL ON TABLE public.store_members TO authenticated;
GRANT ALL ON TABLE public.store_members TO service_role;


--
-- Name: TABLE store_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_modules TO service_role;


--
-- Name: TABLE store_oauth_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_oauth_credentials TO anon;
GRANT ALL ON TABLE public.store_oauth_credentials TO authenticated;
GRANT ALL ON TABLE public.store_oauth_credentials TO service_role;


--
-- Name: TABLE store_priority_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_priority_settings TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.store_priority_settings TO authenticated;


--
-- Name: TABLE store_public_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_public_pages TO anon;
GRANT ALL ON TABLE public.store_public_pages TO authenticated;
GRANT ALL ON TABLE public.store_public_pages TO service_role;


--
-- Name: TABLE store_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_reviews TO anon;
GRANT ALL ON TABLE public.store_reviews TO authenticated;
GRANT ALL ON TABLE public.store_reviews TO service_role;


--
-- Name: TABLE store_setup_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_setup_requests TO service_role;


--
-- Name: TABLE store_staff; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_staff TO service_role;


--
-- Name: TABLE store_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_subscriptions TO anon;
GRANT ALL ON TABLE public.store_subscriptions TO authenticated;
GRANT ALL ON TABLE public.store_subscriptions TO service_role;


--
-- Name: TABLE store_tables; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_tables TO service_role;
GRANT SELECT,INSERT ON TABLE public.store_tables TO authenticated;


--
-- Name: TABLE stores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stores TO anon;
GRANT ALL ON TABLE public.stores TO authenticated;
GRANT ALL ON TABLE public.stores TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE vertical_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.vertical_templates TO authenticated;
GRANT ALL ON TABLE public.vertical_templates TO service_role;


--
-- Name: TABLE visitor_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.visitor_sessions TO anon;
GRANT ALL ON TABLE public.visitor_sessions TO authenticated;
GRANT ALL ON TABLE public.visitor_sessions TO service_role;


--
-- Name: TABLE waiting_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waiting_entries TO anon;
GRANT ALL ON TABLE public.waiting_entries TO authenticated;
GRANT ALL ON TABLE public.waiting_entries TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: core; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA core GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict MYBIZBASELINE20260928V1

