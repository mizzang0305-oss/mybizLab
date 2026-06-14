-- MyBiz public review abuse guard foundation.
-- Purpose: record privacy-preserving review submit attempts for rate limit,
-- captcha, token, and honeypot moderation without storing raw IP/user-agent.
-- Safety: non-destructive. No public read policy; store members only.

create table if not exists public.review_submit_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(store_id) on delete cascade,
  review_request_link_id uuid null references public.review_request_links(link_id) on delete set null,
  ip_hash text not null,
  user_agent_hash text not null,
  body_hash text null,
  outcome text not null check (outcome in ('allowed', 'blocked')),
  reason text not null check (
    reason in (
      'allowed',
      'captcha_failed',
      'duplicate_submit_window',
      'honeypot_detected',
      'rate_limit',
      'token_disabled',
      'token_expired',
      'token_invalid',
      'token_max_uses_exceeded',
      'token_store_mismatch'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists review_submit_attempts_store_created_idx
on public.review_submit_attempts (store_id, created_at desc);

create index if not exists review_submit_attempts_rate_window_idx
on public.review_submit_attempts (store_id, ip_hash, user_agent_hash, created_at desc);

create index if not exists review_submit_attempts_blocked_idx
on public.review_submit_attempts (store_id, outcome, reason, created_at desc);

alter table public.review_submit_attempts enable row level security;

drop policy if exists "review_submit_attempts_member_access" on public.review_submit_attempts;
create policy "review_submit_attempts_member_access"
on public.review_submit_attempts
for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));
