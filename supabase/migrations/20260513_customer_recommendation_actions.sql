-- Customer recommendation action state foundation.
-- This migration is safe to review/apply manually; it does not execute outreach,
-- messaging, publishing, AI calls, or customer/order backfills.

create table if not exists public.customer_recommendation_actions (
  action_id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  customer_id uuid not null,
  recommendation_key text not null,
  recommendation_type text not null check (
    recommendation_type in (
      'reorder',
      'upsell',
      'revisit',
      'review_request',
      'reservation_followup',
      'waiting_followup',
      'content_conversion'
    )
  ),
  status text not null default 'suggested' check (
    status in ('suggested', 'dismissed', 'completed', 'snoozed')
  ),
  note text null,
  acted_by uuid null,
  acted_at timestamptz null,
  snoozed_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_id, recommendation_key)
);

create index if not exists customer_recommendation_actions_store_customer_idx
on public.customer_recommendation_actions (store_id, customer_id);

create index if not exists customer_recommendation_actions_store_status_idx
on public.customer_recommendation_actions (store_id, status, updated_at desc);

alter table public.customer_recommendation_actions enable row level security;

drop policy if exists "store members can read recommendation actions" on public.customer_recommendation_actions;
create policy "store members can read recommendation actions"
on public.customer_recommendation_actions
for select
using (
  exists (
    select 1
    from public.store_members sm
    where sm.store_id = customer_recommendation_actions.store_id
      and sm.profile_id = auth.uid()
  )
);

drop policy if exists "store members can insert recommendation actions" on public.customer_recommendation_actions;
create policy "store members can insert recommendation actions"
on public.customer_recommendation_actions
for insert
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.store_id = customer_recommendation_actions.store_id
      and sm.profile_id = auth.uid()
  )
);

drop policy if exists "store members can update recommendation actions" on public.customer_recommendation_actions;
create policy "store members can update recommendation actions"
on public.customer_recommendation_actions
for update
using (
  exists (
    select 1
    from public.store_members sm
    where sm.store_id = customer_recommendation_actions.store_id
      and sm.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.store_id = customer_recommendation_actions.store_id
      and sm.profile_id = auth.uid()
  )
);
