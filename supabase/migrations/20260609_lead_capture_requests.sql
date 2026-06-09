-- Draft only. Do not apply to production until the RLS migration approval checklist is signed off.

create table if not exists public.lead_capture_requests (
  id uuid primary key default gen_random_uuid(),
  -- Production evidence on 2026-06-10 showed store_members.store_id references stores.store_id.
  -- Reconfirm stores.store_id exists and is uuid before applying this draft.
  store_id uuid null references public.stores(store_id) on delete set null,
  owner_profile_id uuid null references public.profiles(id) on delete set null,
  source text not null check (source in ('onboarding', 'pricing', 'manual', 'referral')),
  status text not null default 'new' check (
    status in (
      'new',
      'needs_review',
      'contacted',
      'pilot_candidate',
      'setup_in_progress',
      'converted',
      'rejected',
      'archived'
    )
  ),
  store_name text not null,
  business_type text not null,
  address_summary text null,
  contact_name text null,
  contact_phone_encrypted text null,
  contact_phone_masked text null,
  contact_email_encrypted text null,
  contact_email_masked text null,
  main_concern text not null,
  desired_outcome text not null,
  current_customer_management text null,
  current_reservation_flow text null,
  current_inquiry_flow text null,
  data_readiness text not null check (data_readiness in ('low', 'medium', 'high')),
  pilot_fit_score integer null check (pilot_fit_score between 0 and 100),
  next_action text null,
  owner_note text null,
  memory_seed_summary text null,
  consent_marketing boolean not null default false,
  consent_contact boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_capture_requests_store_idx
on public.lead_capture_requests (store_id, created_at desc);

create index if not exists lead_capture_requests_status_idx
on public.lead_capture_requests (status, created_at desc);

create index if not exists lead_capture_requests_owner_profile_idx
on public.lead_capture_requests (owner_profile_id, created_at desc);

drop trigger if exists trg_lead_capture_requests_set_updated_at on public.lead_capture_requests;
create trigger trg_lead_capture_requests_set_updated_at
before update on public.lead_capture_requests
for each row execute function public.set_updated_at();

alter table public.lead_capture_requests enable row level security;

drop policy if exists "lead_capture_requests_platform_admin_select" on public.lead_capture_requests;
create policy "lead_capture_requests_platform_admin_select"
on public.lead_capture_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admin_members pam
    where pam.profile_id = auth.uid()
      and pam.role in ('platform_owner', 'platform_admin')
  )
);

drop policy if exists "lead_capture_requests_platform_admin_insert" on public.lead_capture_requests;
create policy "lead_capture_requests_platform_admin_insert"
on public.lead_capture_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.platform_admin_members pam
    where pam.profile_id = auth.uid()
      and pam.role in ('platform_owner', 'platform_admin')
  )
);

drop policy if exists "lead_capture_requests_platform_admin_update" on public.lead_capture_requests;
create policy "lead_capture_requests_platform_admin_update"
on public.lead_capture_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.platform_admin_members pam
    where pam.profile_id = auth.uid()
      and pam.role in ('platform_owner', 'platform_admin')
  )
)
with check (
  exists (
    select 1
    from public.platform_admin_members pam
    where pam.profile_id = auth.uid()
      and pam.role in ('platform_owner', 'platform_admin')
  )
);

drop policy if exists "lead_capture_requests_store_member_select" on public.lead_capture_requests;
create policy "lead_capture_requests_store_member_select"
on public.lead_capture_requests
for select
to authenticated
using (
  store_id is not null
  and public.is_store_member(store_id)
);

drop policy if exists "lead_capture_requests_store_member_update" on public.lead_capture_requests;
create policy "lead_capture_requests_store_member_update"
on public.lead_capture_requests
for update
to authenticated
using (
  store_id is not null
  and public.is_store_member(store_id)
)
with check (
  store_id is not null
  and public.is_store_member(store_id)
);

-- Intentionally absent:
-- - no policy grants anon insert/select/update/delete
-- - no delete policy; use archived status instead of destructive removal
-- - no public form writes to arbitrary store_id
