-- DRAFT ONLY: MyBiz Service OS foundation candidate.
-- Created with Supabase CLI 2.117.0 and kept outside the active migration path.
-- Production apply, migration history mutation, and feature activation require
-- separate exact Owner approvals.
--
-- This foundation intentionally exposes no browser write surface.
-- Authenticated service-job/evidence INSERT belongs to the separately gated
-- 20260914005632_mybiz_service_os_live_write_activation.sql draft.
--
-- Production metadata binding (2026-09-14): public.contracts is absent.
-- Contract remains an optional module represented here only by
-- requires_contract / contract_state. A future canonical contract relation
-- requires an additive migration and a separate exact Owner Gate.

begin;

do $$
declare
  v_required record;
  v_fk record;
  v_attnum smallint;
  v_source_attnum smallint;
  v_target_attnum smallint;
begin
  for v_required in
    select * from (values
      ('stores', 'store_id'),
      ('profiles', 'id'),
      ('customers', 'customer_id')
    ) as required_key(table_name, column_name)
  loop
    if to_regclass(format('public.%I', v_required.table_name)) is null then
      raise exception 'SERVICE_OS_REQUIRED_TABLE_MISSING: public.%', v_required.table_name using errcode = '42P01';
    end if;

    select a.attnum into v_attnum
    from pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', v_required.table_name))
      and a.attname = v_required.column_name
      and a.attnum > 0
      and not a.attisdropped;

    if v_attnum is null then
      raise exception 'SERVICE_OS_REQUIRED_COLUMN_MISSING: public.%.%', v_required.table_name, v_required.column_name using errcode = '42703';
    end if;

    if not exists (
      select 1
      from pg_constraint c
      where c.conrelid = to_regclass(format('public.%I', v_required.table_name))
        and c.contype in ('p', 'u')
        and c.conkey = array[v_attnum]::smallint[]
    ) then
      raise exception 'SERVICE_OS_FK_TARGET_NOT_UNIQUE: public.%.%', v_required.table_name, v_required.column_name using errcode = '42830';
    end if;
  end loop;

  for v_fk in
    select * from (values
      ('store_members', 'store_id', 'stores', 'store_id'),
      ('store_members', 'profile_id', 'profiles', 'id')
    ) as required_fk(source_table, source_column, target_table, target_column)
  loop
    if to_regclass(format('public.%I', v_fk.source_table)) is null then
      raise exception 'SERVICE_OS_REQUIRED_TABLE_MISSING: public.%', v_fk.source_table using errcode = '42P01';
    end if;

    select a.attnum into v_source_attnum
    from pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', v_fk.source_table))
      and a.attname = v_fk.source_column
      and a.attnum > 0
      and not a.attisdropped;

    select a.attnum into v_target_attnum
    from pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', v_fk.target_table))
      and a.attname = v_fk.target_column
      and a.attnum > 0
      and not a.attisdropped;

    if not exists (
      select 1
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = to_regclass(format('public.%I', v_fk.source_table))
        and c.confrelid = to_regclass(format('public.%I', v_fk.target_table))
        and c.conkey = array[v_source_attnum]::smallint[]
        and c.confkey = array[v_target_attnum]::smallint[]
    ) then
      raise exception 'SERVICE_OS_REQUIRED_FK_MISMATCH: public.%.% -> public.%.%',
        v_fk.source_table, v_fk.source_column, v_fk.target_table, v_fk.target_column using errcode = '42830';
    end if;
  end loop;

  if to_regprocedure('public.is_store_member(uuid)') is null then
    raise exception 'SERVICE_OS_MEMBERSHIP_FUNCTION_MISSING: public.is_store_member(uuid)' using errcode = '42883';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'service_jobs', 'job_evidence_assets', 'job_evidence_revisions',
        'job_confirmations', 'job_confirmation_links', 'consent_records',
        'job_payment_requests', 'content_candidates', 'brand_sites',
        'brand_site_portfolio_items', 'vertical_templates'
      ])
  ) then
    raise exception 'SERVICE_OS_RELATION_COLLISION_REQUIRES_MANUAL_COMPATIBILITY_REVIEW' using errcode = '42P07';
  end if;

  if to_regprocedure('private.initialize_job_evidence_revision()') is not null
    or to_regprocedure('private.create_next_job_evidence_revision(uuid,uuid,text)') is not null
    or to_regprocedure('private.consume_job_confirmation_link(text,text,text,jsonb)') is not null
    or to_regprocedure('private.is_service_os_publication_eligible(uuid,uuid,integer,text,timestamp with time zone)') is not null
  then
    raise exception 'SERVICE_OS_FUNCTION_COLLISION_REQUIRES_MANUAL_COMPATIBILITY_REVIEW' using errcode = '42723';
  end if;
end;
$$;

create schema if not exists private;

create table public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  customer_id uuid references public.customers(customer_id) on delete set null,
  vertical text not null check (vertical in ('cleaning', 'hair', 'installation', 'wig', 'interior', 'medical')),
  service_name text not null,
  requires_contract boolean not null default false,
  contract_state text not null default 'NOT_REQUIRED' check (contract_state in ('NOT_REQUIRED', 'DRAFT', 'SENT', 'ACCEPTED', 'SIGNED')),
  state text not null default 'JOB_CREATED' check (state in ('JOB_CREATED', 'CONTRACT_REQUIRED', 'WORK_READY', 'WORK_IN_PROGRESS', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'CUSTOMER_CORRECTION_REQUESTED', 'CONFIRMATION_OUTDATED')),
  evidence_revision integer not null default 1 check (evidence_revision > 0),
  payment_state text not null default 'PAYMENT_NOT_REQUESTED' check (payment_state in ('PAYMENT_NOT_REQUESTED', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED')),
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((requires_contract and contract_state <> 'NOT_REQUIRED') or (not requires_contract and contract_state = 'NOT_REQUIRED')),
  check (state in ('JOB_CREATED', 'CONTRACT_REQUIRED') or not requires_contract or contract_state in ('ACCEPTED', 'SIGNED')),
  unique (id, store_id)
);

create table public.job_evidence_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  created_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (job_id, store_id) references public.service_jobs(id, store_id) on delete cascade,
  unique (job_id, revision_number),
  unique (job_id, revision_number, store_id)
);

create table public.job_evidence_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  uploader_user_id uuid not null references public.profiles(id),
  evidence_type text not null check (evidence_type in ('before_photo', 'during_photo', 'after_photo', 'video', 'document', 'checklist', 'other')),
  storage_provider text not null check (storage_provider in ('local', 'supabase')),
  storage_object_key text not null,
  original_filename text not null check (char_length(original_filename) between 1 and 255 and position('/' in original_filename) = 0 and position(chr(92) in original_filename) = 0),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf', 'application/json')),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  server_received_at timestamptz not null default timezone('utc', now()),
  client_capture_at timestamptz,
  client_timezone text,
  metadata jsonb not null default '{}'::jsonb,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'active' check (status in ('active', 'superseded', 'quarantined')),
  check (
    storage_object_key like 'stores/' || store_id::text || '/jobs/' || job_id::text || '/revisions/' || revision_number::text || '/%'
    and position('..' in storage_object_key) = 0
    and position(chr(92) in storage_object_key) = 0
  ),
  foreign key (job_id, store_id) references public.service_jobs(id, store_id) on delete cascade,
  foreign key (job_id, revision_number, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id),
  unique (store_id, storage_provider, storage_object_key)
);

create table public.job_confirmations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  evidence_revision integer not null check (evidence_revision > 0),
  outcome text not null check (outcome in ('confirmed', 'correction_requested')),
  actor_label text,
  confirmed_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  foreign key (job_id, evidence_revision, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id),
  unique (job_id, evidence_revision)
);

create table public.job_confirmation_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  evidence_revision integer not null check (evidence_revision > 0),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (job_id, evidence_revision, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  evidence_revision integer not null check (evidence_revision > 0),
  purpose text not null check (purpose in ('privacy', 'marketing', 'website', 'blog', 'social', 'medical_advertising')),
  text_version text not null,
  channels text[] not null default '{}',
  actor text not null check (actor in ('customer', 'guardian')),
  source text not null check (source in ('secure_link', 'paper_record', 'staff_recorded')),
  granted_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (job_id, evidence_revision, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id)
);

create table public.job_payment_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  status text not null default 'PAYMENT_NOT_REQUESTED' check (status in ('PAYMENT_NOT_REQUESTED', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED')),
  amount numeric(12, 2),
  currency text not null default 'KRW',
  provider text not null default 'manual_tracking',
  provider_reference text,
  requested_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (job_id, store_id) references public.service_jobs(id, store_id) on delete cascade
);

create table public.content_candidates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  job_id uuid not null,
  evidence_revision integer not null check (evidence_revision > 0),
  channel text not null check (channel in ('website', 'blog', 'instagram', 'tiktok', 'youtube_shorts')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'GENERATED', 'REVIEW_REQUIRED', 'APPROVED', 'PUBLISH_READY', 'PUBLISHED', 'FAILED')),
  draft_payload jsonb not null default '{}'::jsonb,
  merchant_approved_at timestamptz,
  provider_receipt jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (job_id, evidence_revision, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id),
  unique (id, job_id, evidence_revision, store_id)
);

create table public.brand_sites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(store_id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tier text not null default 'basic' check (tier in ('basic', 'brand', 'growth')),
  status text not null default 'draft' check (status in ('draft', 'preview', 'published', 'suspended')),
  theme jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  custom_domain text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, store_id)
);

create table public.brand_site_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  brand_site_id uuid not null,
  job_id uuid not null,
  evidence_revision integer not null check (evidence_revision > 0),
  content_candidate_id uuid,
  title text not null,
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'withdrawn')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (brand_site_id, store_id) references public.brand_sites(id, store_id) on delete cascade,
  foreign key (job_id, evidence_revision, store_id) references public.job_evidence_revisions(job_id, revision_number, store_id),
  foreign key (content_candidate_id, job_id, evidence_revision, store_id)
    references public.content_candidates(id, job_id, evidence_revision, store_id)
);

create table public.vertical_templates (
  id text primary key check (id in ('cleaning', 'hair', 'installation', 'wig', 'interior', 'medical')),
  label text not null,
  public_v1 boolean not null default false,
  medical_mode boolean not null default false,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (not public_v1 or id in ('cleaning', 'hair', 'installation')),
  check (not medical_mode or id = 'medical'),
  check (not (id = 'medical' and public_v1))
);

create or replace function private.initialize_job_evidence_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by, reason)
  values (new.store_id, new.id, new.evidence_revision, new.created_by, 'job_created');
  return new;
end;
$$;

create or replace function private.create_next_job_evidence_revision(p_job_id uuid, p_actor_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function private.consume_job_confirmation_link(
  p_token_hash text,
  p_outcome text,
  p_actor_label text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function private.is_service_os_publication_eligible(
  p_store_id uuid,
  p_job_id uuid,
  p_revision integer,
  p_channel text,
  p_merchant_approved_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

create or replace function private.enforce_content_candidate_terminal_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function private.enforce_portfolio_publication_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function private.initialize_job_evidence_revision() from public, anon, authenticated;
revoke all on function private.create_next_job_evidence_revision(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.consume_job_confirmation_link(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.is_service_os_publication_eligible(uuid, uuid, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function private.enforce_content_candidate_terminal_state() from public, anon, authenticated;
revoke all on function private.enforce_portfolio_publication_eligibility() from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.create_next_job_evidence_revision(uuid, uuid, text) to service_role;
grant execute on function private.consume_job_confirmation_link(text, text, text, jsonb) to service_role;
grant execute on function private.is_service_os_publication_eligible(uuid, uuid, integer, text, timestamptz) to service_role;

create trigger initialize_job_evidence_revision_after_insert
after insert on public.service_jobs
for each row execute function private.initialize_job_evidence_revision();

create trigger enforce_content_candidate_terminal_state_before_write
before insert or update on public.content_candidates
for each row execute function private.enforce_content_candidate_terminal_state();

create trigger enforce_portfolio_publication_eligibility_before_write
before insert or update on public.brand_site_portfolio_items
for each row execute function private.enforce_portfolio_publication_eligibility();

create index service_jobs_store_state_created_idx on public.service_jobs(store_id, state, created_at desc);
create index job_evidence_assets_job_revision_idx on public.job_evidence_assets(job_id, revision_number, evidence_type);
create index job_confirmations_job_revision_idx on public.job_confirmations(job_id, evidence_revision, confirmed_at desc);
create index consent_records_job_revision_idx on public.consent_records(job_id, evidence_revision, purpose, granted_at desc);
create index content_candidates_store_status_idx on public.content_candidates(store_id, status, created_at desc);

alter table public.service_jobs enable row level security;
alter table public.job_evidence_assets enable row level security;
alter table public.job_evidence_revisions enable row level security;
alter table public.job_confirmations enable row level security;
alter table public.job_confirmation_links enable row level security;
alter table public.consent_records enable row level security;
alter table public.job_payment_requests enable row level security;
alter table public.content_candidates enable row level security;
alter table public.brand_sites enable row level security;
alter table public.brand_site_portfolio_items enable row level security;
alter table public.vertical_templates enable row level security;

alter table public.service_jobs force row level security;
alter table public.job_evidence_assets force row level security;
alter table public.job_evidence_revisions force row level security;
alter table public.job_confirmations force row level security;
alter table public.job_confirmation_links force row level security;
alter table public.consent_records force row level security;
alter table public.job_payment_requests force row level security;
alter table public.content_candidates force row level security;
alter table public.brand_sites force row level security;
alter table public.brand_site_portfolio_items force row level security;
alter table public.vertical_templates force row level security;

revoke all privileges on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.job_confirmation_links, public.consent_records, public.job_payment_requests,
  public.content_candidates, public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates
  from public, anon, authenticated;

grant select on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.consent_records, public.job_payment_requests, public.content_candidates,
  public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates to authenticated;

grant all privileges on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.job_confirmation_links, public.consent_records, public.job_payment_requests,
  public.content_candidates, public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates
  to service_role;

create policy service_jobs_member_select on public.service_jobs for select to authenticated using (public.is_store_member(store_id));
create policy evidence_assets_member_select on public.job_evidence_assets for select to authenticated using (public.is_store_member(store_id));
create policy evidence_revisions_member_select on public.job_evidence_revisions for select to authenticated using (public.is_store_member(store_id));
create policy confirmations_member_select on public.job_confirmations for select to authenticated using (public.is_store_member(store_id));
create policy consent_records_member_select on public.consent_records for select to authenticated using (public.is_store_member(store_id));
create policy payment_requests_member_select on public.job_payment_requests for select to authenticated using (public.is_store_member(store_id));
create policy content_candidates_member_select on public.content_candidates for select to authenticated using (public.is_store_member(store_id));
create policy brand_sites_member_select on public.brand_sites for select to authenticated using (public.is_store_member(store_id));
create policy portfolio_items_member_select on public.brand_site_portfolio_items for select to authenticated using (public.is_store_member(store_id));
create policy vertical_templates_public_v1_select on public.vertical_templates for select to authenticated
  using (public_v1 and not medical_mode and id in ('cleaning', 'hair', 'installation'));

commit;
