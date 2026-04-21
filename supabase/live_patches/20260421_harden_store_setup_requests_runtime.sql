alter table if exists public.store_setup_requests
  add column if not exists requested_plan text not null default 'free';

alter table if exists public.store_setup_requests
  drop constraint if exists store_setup_requests_requested_plan_check;

alter table if exists public.store_setup_requests
  add constraint store_setup_requests_requested_plan_check
  check (requested_plan in ('free', 'pro', 'vip'));

drop policy if exists "setup_requests_manage_own" on public.store_setup_requests;
drop policy if exists "setup_requests_select_own" on public.store_setup_requests;
drop policy if exists "setup_requests_update_own" on public.store_setup_requests;

create policy "setup_requests_select_own"
on public.store_setup_requests
for select
using (auth.uid() = created_by);

create policy "setup_requests_update_own"
on public.store_setup_requests
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create index if not exists store_setup_requests_requested_slug_idx
  on public.store_setup_requests (requested_slug);

create index if not exists store_setup_requests_email_idx
  on public.store_setup_requests (email);
