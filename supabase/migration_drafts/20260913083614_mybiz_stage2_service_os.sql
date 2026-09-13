-- DRAFT ONLY: MyBiz Stage 2 Service OS additive schema.
-- Generated with Supabase CLI 2.117.0. Not applied locally or remotely.
-- Production execution, migration history repair and DB writes require a separate Owner Gate.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
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
  check (
    state in ('JOB_CREATED', 'CONTRACT_REQUIRED')
    or not requires_contract
    or contract_state in ('ACCEPTED', 'SIGNED')
  ),
  unique (id, store_id)
);

create table if not exists public.job_evidence_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  uploader_user_id uuid not null references public.profiles(id),
  evidence_type text not null check (evidence_type in ('before_photo', 'during_photo', 'after_photo', 'video', 'document', 'checklist', 'other')),
  storage_provider text not null check (storage_provider in ('local', 'supabase')),
  storage_object_key text not null,
  original_filename text not null check (
    char_length(original_filename) between 1 and 255
    and position('/' in original_filename) = 0
    and position(chr(92) in original_filename) = 0
  ),
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
    storage_object_key like
      'stores/' || store_id::text || '/jobs/' || job_id::text || '/revisions/' || revision_number::text || '/%'
    and position('..' in storage_object_key) = 0
    and position(chr(92) in storage_object_key) = 0
  ),
  unique (store_id, storage_provider, storage_object_key)
);

create table if not exists public.job_evidence_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  created_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, revision_number),
  unique (job_id, revision_number, store_id)
);

create table if not exists public.job_confirmations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  evidence_revision integer not null check (evidence_revision > 0),
  outcome text not null check (outcome in ('confirmed', 'correction_requested')),
  actor_label text,
  confirmed_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (job_id, evidence_revision)
);

create table if not exists public.job_confirmation_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  evidence_revision integer not null check (evidence_revision > 0),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  evidence_revision integer not null check (evidence_revision > 0),
  purpose text not null check (purpose in ('privacy', 'marketing', 'website', 'blog', 'social', 'medical_advertising')),
  text_version text not null,
  channels text[] not null default '{}',
  actor text not null check (actor in ('customer', 'guardian')),
  source text not null check (source in ('secure_link', 'paper_record', 'staff_recorded')),
  granted_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.job_payment_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  status text not null default 'PAYMENT_NOT_REQUESTED' check (status in ('PAYMENT_NOT_REQUESTED', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED')),
  amount numeric(12, 2),
  currency text not null default 'KRW',
  provider text not null default 'manual_tracking',
  provider_reference text,
  requested_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_candidates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  evidence_revision integer not null check (evidence_revision > 0),
  channel text not null check (channel in ('website', 'blog', 'instagram', 'tiktok', 'youtube_shorts')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'GENERATED', 'REVIEW_REQUIRED', 'APPROVED', 'PUBLISH_READY', 'PUBLISHED', 'FAILED')),
  draft_payload jsonb not null default '{}'::jsonb,
  merchant_approved_at timestamptz,
  provider_receipt jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brand_sites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tier text not null default 'basic' check (tier in ('basic', 'brand', 'growth')),
  status text not null default 'draft' check (status in ('draft', 'preview', 'published', 'suspended')),
  theme jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  custom_domain text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brand_site_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  brand_site_id uuid not null references public.brand_sites(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  evidence_revision integer not null check (evidence_revision > 0),
  content_candidate_id uuid references public.content_candidates(id) on delete set null,
  title text not null,
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'withdrawn')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vertical_templates (
  id text primary key,
  label text not null,
  public_v1 boolean not null default false,
  medical_mode boolean not null default false,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.job_evidence_assets
  add constraint job_evidence_assets_revision_fk
  foreign key (job_id, revision_number, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);
alter table public.job_confirmations
  add constraint job_confirmations_revision_fk
  foreign key (job_id, evidence_revision, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);
alter table public.job_confirmation_links
  add constraint job_confirmation_links_revision_fk
  foreign key (job_id, evidence_revision, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);
alter table public.consent_records
  add constraint consent_records_revision_fk
  foreign key (job_id, evidence_revision, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);
alter table public.content_candidates
  add constraint content_candidates_revision_fk
  foreign key (job_id, evidence_revision, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);
alter table public.brand_site_portfolio_items
  add constraint brand_site_portfolio_items_revision_fk
  foreign key (job_id, evidence_revision, store_id)
  references public.job_evidence_revisions (job_id, revision_number, store_id);

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

revoke all on function private.initialize_job_evidence_revision() from public, anon, authenticated;

create trigger initialize_job_evidence_revision_after_insert
after insert on public.service_jobs
for each row execute function private.initialize_job_evidence_revision();

create or replace function private.create_next_job_evidence_revision(
  p_job_id uuid,
  p_actor_id uuid,
  p_reason text
)
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
  select j.store_id, j.evidence_revision
    into v_store_id, v_current_revision
  from public.service_jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'SERVICE_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_id is null or not exists (
    select 1
    from public.store_members sm
    where sm.store_id = v_store_id and sm.profile_id = p_actor_id
  ) then
    raise exception 'SERVICE_JOB_MEMBER_REQUIRED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.job_confirmations c
    where c.job_id = p_job_id
      and c.evidence_revision = v_current_revision
      and c.outcome = 'confirmed'
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

revoke all on function private.create_next_job_evidence_revision(uuid, uuid, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.create_next_job_evidence_revision(uuid, uuid, text) to service_role;

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
      where j.id = v_link.job_id
        and j.store_id = v_link.store_id
        and j.evidence_revision = v_link.evidence_revision
    ) then
    raise exception 'CONFIRMATION_LINK_INVALID' using errcode = '22023';
  end if;

  insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome, actor_label, metadata)
  values (v_link.store_id, v_link.job_id, v_link.evidence_revision, p_outcome, p_actor_label, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_confirmation_id;

  update public.job_confirmation_links
  set consumed_at = timezone('utc', now())
  where id = v_link.id;

  update public.service_jobs
  set state = case when p_outcome = 'confirmed' then 'CUSTOMER_CONFIRMED' else 'CUSTOMER_CORRECTION_REQUESTED' end,
      updated_at = timezone('utc', now())
  where id = v_link.job_id;

  return v_confirmation_id;
end;
$$;

revoke all on function private.consume_job_confirmation_link(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.consume_job_confirmation_link(text, text, text, jsonb) to service_role;

create index if not exists service_jobs_store_state_created_idx on public.service_jobs (store_id, state, created_at desc);
create index if not exists job_evidence_assets_job_revision_idx on public.job_evidence_assets (job_id, revision_number, evidence_type);
create index if not exists job_confirmations_job_revision_idx on public.job_confirmations (job_id, evidence_revision, confirmed_at desc);
create index if not exists consent_records_job_revision_idx on public.consent_records (job_id, evidence_revision, purpose, granted_at desc);
create index if not exists content_candidates_store_status_idx on public.content_candidates (store_id, status, created_at desc);

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

revoke all privileges on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.job_confirmation_links, public.consent_records, public.job_payment_requests,
  public.content_candidates, public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates
  from public, anon, authenticated;

-- Browser roles may create the job shell and append original evidence metadata only.
-- Confirmation, consent, payment, publication and brand-site mutations stay behind a
-- server/service-role boundary so clients cannot self-assert a trusted terminal state.
grant select on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.consent_records, public.job_payment_requests, public.content_candidates,
  public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates to authenticated;
grant insert on table public.service_jobs, public.job_evidence_assets to authenticated;
grant all privileges on table public.service_jobs, public.job_evidence_assets, public.job_evidence_revisions,
  public.job_confirmations, public.job_confirmation_links, public.consent_records, public.job_payment_requests,
  public.content_candidates, public.brand_sites, public.brand_site_portfolio_items, public.vertical_templates
  to service_role;

create policy service_jobs_member_select on public.service_jobs for select to authenticated using (public.is_store_member(store_id));
create policy service_jobs_member_insert on public.service_jobs for insert to authenticated with check (
  public.is_store_member(store_id)
  and created_by = auth.uid()
  and evidence_revision = 1
  and payment_state = 'PAYMENT_NOT_REQUESTED'
  and state in ('JOB_CREATED', 'CONTRACT_REQUIRED', 'WORK_READY')
  and (customer_id is null or exists (select 1 from public.customers c where c.id = service_jobs.customer_id and c.store_id = service_jobs.store_id))
  and (contract_id is null or exists (select 1 from public.contracts c where c.id = service_jobs.contract_id and c.store_id = service_jobs.store_id))
);
create policy evidence_assets_member_select on public.job_evidence_assets for select to authenticated using (public.is_store_member(store_id));
create policy evidence_assets_member_insert on public.job_evidence_assets for insert to authenticated with check (
  public.is_store_member(store_id)
  and uploader_user_id = auth.uid()
  and status = 'active'
  and exists (
    select 1 from public.service_jobs j
    where j.id = job_evidence_assets.job_id
      and j.store_id = job_evidence_assets.store_id
      and j.evidence_revision = job_evidence_assets.revision_number
  )
);
create policy evidence_revisions_member_select on public.job_evidence_revisions for select to authenticated using (public.is_store_member(store_id));
create policy confirmations_member_select on public.job_confirmations for select to authenticated using (public.is_store_member(store_id));
create policy consent_records_member_select on public.consent_records for select to authenticated using (public.is_store_member(store_id));
create policy payment_requests_member_select on public.job_payment_requests for select to authenticated using (public.is_store_member(store_id));
create policy content_candidates_member_select on public.content_candidates for select to authenticated using (public.is_store_member(store_id));
create policy brand_sites_member_select on public.brand_sites for select to authenticated using (public.is_store_member(store_id));
create policy portfolio_items_member_select on public.brand_site_portfolio_items for select to authenticated using (public.is_store_member(store_id));
create policy vertical_templates_member_select on public.vertical_templates for select to authenticated using (not medical_mode);

commit;

-- Rollback plan (review and Owner approval required before execution):
-- Drop the Stage 2 tables in reverse dependency order. This is destructive and intentionally not executable here.
