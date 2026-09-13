-- Local-only pgTAP rehearsal. Apply the production baseline and the Stage 2 draft
-- to a disposable Supabase local stack before running `supabase test db --local`.
-- Never run this seed against a linked or Production database.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
select extensions.plan(20);

set local role postgres;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'member-a@example.invalid', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'member-b@example.invalid', '{}'::jsonb);

insert into public.profiles (id, full_name, email)
values
  ('10000000-0000-0000-0000-000000000001', 'Member A', 'member-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'Member B', 'member-b@example.invalid');

insert into public.stores (id, name, slug, owner_name, business_number, phone, email, address, business_type)
values
  ('20000000-0000-0000-0000-000000000001', 'Store A', 'stage2-store-a', 'Owner A', '000-00-00001', '000-0000-0001', 'store-a@example.invalid', 'Synthetic A', 'cleaning'),
  ('20000000-0000-0000-0000-000000000002', 'Store B', 'stage2-store-b', 'Owner B', '000-00-00002', '000-0000-0002', 'store-b@example.invalid', 'Synthetic B', 'hair');

insert into public.store_members (store_id, profile_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner');

insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'hair', 'Other tenant job', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000002');

insert into public.vertical_templates (id, label, public_v1, medical_mode)
values ('medical-local-only', 'Medical local only', false, true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select extensions.lives_ok(
  $$insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Member job', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'MEMBER_JOB_INSERT_ALLOW'
);

select extensions.lives_ok(
  $$insert into public.job_evidence_assets (store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'before_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/1/original/40000000-0000-0000-0000-000000000001', 'before.png', 'image/png', 3, repeat('a', 64), 1)$$,
  'MEMBER_EVIDENCE_INSERT_ALLOW'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.service_jobs where store_id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'MEMBER_OWN_DATA_SELECT_ALLOW'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.service_jobs where store_id = '20000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'CROSS_TENANT_SELECT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000002', 'hair', 'Cross tenant', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'CROSS_TENANT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Draft contract', true, 'DRAFT', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'CONTRACT_DRAFT_WORK_READY_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Sent contract', true, 'SENT', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'CONTRACT_SENT_WORK_READY_DENY'
);

select extensions.lives_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Accepted contract', true, 'ACCEPTED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'CONTRACT_ACCEPTED_WORK_READY_ALLOW'
);

select extensions.lives_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Signed contract', true, 'SIGNED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'CONTRACT_SIGNED_WORK_READY_ALLOW'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 999, '10000000-0000-0000-0000-000000000001')$$,
  'REVISION_999_DIRECT_CLIENT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_assets (store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'after_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/999/original/40000000-0000-0000-0000-000000000002', 'future.png', 'image/png', 3, repeat('b', 64), 999)$$,
  'FUTURE_REVISION_ASSET_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_payment_requests (store_id, job_id, status, amount)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'PAYMENT_PAID', 1000)$$,
  'PAYMENT_SELF_MARK_PAID_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'confirmed')$$,
  'CUSTOMER_CONFIRMATION_DIRECT_CLIENT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.consent_records (store_id, job_id, evidence_revision, purpose, text_version, channels, actor, source)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'marketing', 'v1', array['website'], 'customer', 'secure_link')$$,
  'CONSENT_DIRECT_CLIENT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.content_candidates (store_id, job_id, evidence_revision, channel, status)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'website', 'APPROVED')$$,
  'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY'
);

select extensions.throws_ok(
  $$insert into public.brand_sites (store_id, slug, status)
    values ('20000000-0000-0000-0000-000000000001', 'forged-published-site', 'published')$$,
  'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.vertical_templates where medical_mode$$,
  array[0::bigint],
  'MEDICAL_TEMPLATE_PUBLIC_DEFAULT_DENY'
);

select extensions.throws_ok(
  $$select token_hash from public.job_confirmation_links$$,
  'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY'
);

set local role anon;
select extensions.throws_ok(
  $$select token_hash from public.job_confirmation_links$$,
  'CONFIRMATION_TOKEN_HASH_ANON_READ_DENY'
);

set local role service_role;
select extensions.lives_ok(
  $$insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'confirmed')$$,
  'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW'
);

select * from extensions.finish();
rollback;
