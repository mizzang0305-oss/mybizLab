-- Local-only pgTAP rehearsal against the current Production schema baseline.
-- The historical Stage 2 draft has different direct-client grants; do not apply it.
-- Never run this seed against a linked or Production database.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
select extensions.plan(48);

set local role postgres;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'member-a@example.invalid', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'member-b@example.invalid', '{}'::jsonb);

insert into public.profiles (id, full_name, email)
values
  ('10000000-0000-0000-0000-000000000001', 'Member A', 'member-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'Member B', 'member-b@example.invalid');

insert into core.profiles (id, is_active)
values
  ('10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', true);

insert into private.profile_auth_bindings (public_profile_id, auth_profile_id, binding_source, status)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'OWNER_VERIFIED', 'ACTIVE'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'OWNER_VERIFIED', 'ACTIVE');

insert into public.stores (store_id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Store A', 'stage2-store-a'),
  ('20000000-0000-0000-0000-000000000002', 'Store B', 'stage2-store-b');

insert into public.store_members (store_id, profile_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner');

insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Own store job', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'hair', 'Other tenant job', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000002');

insert into public.job_evidence_assets (store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'before_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/1/original/40000000-0000-0000-0000-000000000001', 'before.png', 'image/png', 3, repeat('a', 64), 1),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'before_photo', 'local', 'stores/20000000-0000-0000-0000-000000000002/jobs/30000000-0000-0000-0000-000000000002/revisions/1/original/40000000-0000-0000-0000-000000000002', 'before-b.png', 'image/png', 3, repeat('b', 64), 1);

insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'confirmed'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 'confirmed');
insert into public.consent_records (store_id, job_id, evidence_revision, purpose, text_version, channels, actor, source)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'website', 'v1', array['website'], 'customer', 'secure_link'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 'website', 'v1', array['website'], 'customer', 'secure_link');
insert into public.job_payment_requests (store_id, job_id, status)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'PAYMENT_REQUESTED'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'PAYMENT_REQUESTED');
insert into public.content_candidates (store_id, job_id, evidence_revision, channel)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'website'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 'website');
insert into public.brand_sites (store_id, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'synthetic-a'),
  ('20000000-0000-0000-0000-000000000002', 'synthetic-b');
insert into public.job_confirmation_links (store_id, job_id, evidence_revision, token_hash, expires_at)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, repeat('c', 64), now() + interval '1 hour');
insert into public.vertical_templates (id, label, public_v1, medical_mode)
values ('cleaning', 'Cleaning synthetic', true, false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select extensions.is((select count(*)::bigint from unnest(array[
  'service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations',
  'consent_records','job_payment_requests','content_candidates','brand_sites',
  'brand_site_portfolio_items','vertical_templates']) as t(name)
  where has_table_privilege('authenticated', format('public.%I', name), 'SELECT')),
  10::bigint, 'AUTHENTICATED_STAGE2_READ_GRANTS_10');
select extensions.is((select count(*)::bigint from unnest(array[
  'service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations',
  'job_confirmation_links','consent_records','job_payment_requests','content_candidates',
  'brand_sites','brand_site_portfolio_items','vertical_templates']) as t(name)
  where has_table_privilege('authenticated', format('public.%I', name), 'INSERT')
     or has_table_privilege('authenticated', format('public.%I', name), 'UPDATE')
     or has_table_privilege('authenticated', format('public.%I', name), 'DELETE')),
  0::bigint, 'AUTHENTICATED_STAGE2_DIRECT_WRITE_GRANTS_ZERO');
select extensions.is((select count(*)::bigint from unnest(array[
  'service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations',
  'job_confirmation_links','consent_records','job_payment_requests','content_candidates',
  'brand_sites','brand_site_portfolio_items','vertical_templates']) as t(name)
  where has_table_privilege('service_role', format('public.%I', name), 'SELECT')
    and has_table_privilege('service_role', format('public.%I', name), 'INSERT')
    and has_table_privilege('service_role', format('public.%I', name), 'UPDATE')
    and has_table_privilege('service_role', format('public.%I', name), 'DELETE')),
  11::bigint, 'SERVICE_ROLE_STAGE2_CRUD_GRANTS_11');

select extensions.throws_ok(
  $$insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Direct browser job', false, 'NOT_REQUIRED', 'JOB_CREATED', '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'MEMBER_JOB_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'cleaning', 'No-contract work ready', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'NO_CONTRACT_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_assets (store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'before_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/1/original/40000000-0000-0000-0000-000000000001', 'before.png', 'image/png', 3, repeat('a', 64), 1)$$,
  '42501', null, 'MEMBER_EVIDENCE_DIRECT_INSERT_DENY'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.service_jobs where id = '30000000-0000-0000-0000-000000000001' and store_id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'MEMBER_OWN_DATA_SELECT_ALLOW'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.service_jobs where store_id = '20000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'CROSS_TENANT_SELECT_DENY'
);

select extensions.results_eq($$select count(*)::bigint from public.job_evidence_assets$$, array[1::bigint], 'MEMBER_OWN_EVIDENCE_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.job_evidence_revisions$$, array[1::bigint], 'MEMBER_OWN_REVISION_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.job_confirmations$$, array[1::bigint], 'MEMBER_OWN_CONFIRMATION_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.consent_records$$, array[1::bigint], 'MEMBER_OWN_CONSENT_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.job_payment_requests$$, array[1::bigint], 'MEMBER_OWN_PAYMENT_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.content_candidates$$, array[1::bigint], 'MEMBER_OWN_CONTENT_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.brand_sites$$, array[1::bigint], 'MEMBER_OWN_BRAND_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.vertical_templates where id = 'cleaning'$$, array[1::bigint], 'ALLOWED_TEMPLATE_READ_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.job_evidence_assets where store_id = '20000000-0000-0000-0000-000000000002'$$, array[0::bigint], 'CROSS_TENANT_EVIDENCE_READ_DENY');
select extensions.results_eq($$select count(*)::bigint from public.job_confirmations where store_id = '20000000-0000-0000-0000-000000000002'$$, array[0::bigint], 'CROSS_TENANT_CONFIRMATION_READ_DENY');

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000002', 'hair', 'Cross tenant', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'CROSS_TENANT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Draft contract', true, 'DRAFT', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'CONTRACT_DRAFT_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Sent contract', true, 'SENT', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'CONTRACT_SENT_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Accepted contract', true, 'ACCEPTED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'CONTRACT_ACCEPTED_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.service_jobs (store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'Signed contract', true, 'SIGNED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'CONTRACT_SIGNED_DIRECT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 999, '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'REVISION_ARBITRARY_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_revisions (store_id, job_id, revision_number, created_by)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 3, '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'REVISION_SKIP_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_evidence_assets (store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'after_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/999/original/40000000-0000-0000-0000-000000000002', 'future.png', 'image/png', 3, repeat('b', 64), 999)$$,
  '42501',
  null,
  'INVALID_REVISION_EVIDENCE_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_payment_requests (store_id, job_id, status, amount)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'PAYMENT_PAID', 1000)$$,
  '42501',
  null,
  'PAYMENT_SELF_MARK_PAID_DENY'
);

select extensions.throws_ok(
  $$insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'confirmed')$$,
  '42501',
  null,
  'CONFIRMATION_DIRECT_CLIENT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.consent_records (store_id, job_id, evidence_revision, purpose, text_version, channels, actor, source)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'marketing', 'v1', array['website'], 'customer', 'secure_link')$$,
  '42501',
  null,
  'CONSENT_DIRECT_CLIENT_INSERT_DENY'
);

select extensions.throws_ok(
  $$insert into public.content_candidates (store_id, job_id, evidence_revision, channel, status)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'website', 'APPROVED')$$,
  '42501',
  null,
  'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY'
);

select extensions.throws_ok(
  $$insert into public.brand_sites (store_id, slug, status)
    values ('20000000-0000-0000-0000-000000000001', 'forged-published-site', 'published')$$,
  '42501',
  null,
  'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY'
);

select extensions.results_eq(
  $$select count(*)::bigint from public.vertical_templates where medical_mode$$,
  array[0::bigint],
  'MEDICAL_PUBLIC_DEFAULT_DENY'
);

select extensions.throws_ok(
  $$select token_hash from public.job_confirmation_links$$,
  '42501',
  null,
  'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY'
);

select extensions.throws_ok($$update public.service_jobs set service_name = 'forged' where id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'MEMBER_JOB_DIRECT_UPDATE_DENY');
select extensions.throws_ok($$delete from public.service_jobs where id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'MEMBER_JOB_DIRECT_DELETE_DENY');
select extensions.throws_ok($$insert into public.job_confirmation_links (store_id, job_id, evidence_revision, token_hash, expires_at)
  values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, repeat('d', 64), now() + interval '1 hour')$$,
  '42501', null, 'CONFIRMATION_LINK_DIRECT_INSERT_DENY');
select extensions.ok(not has_function_privilege('authenticated',
  'private.consume_job_confirmation_link(text,text,text,jsonb)', 'EXECUTE'),
  'CONFIRMATION_CONSUME_FUNCTION_CLIENT_DENY');

set local role anon;
select extensions.throws_ok(
  $$select token_hash from public.job_confirmation_links$$,
  '42501',
  null,
  'CONFIRMATION_TOKEN_HASH_ANON_READ_DENY'
);

set local role service_role;
select extensions.lives_ok(
  $$insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
    values ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Server-created job', false, 'NOT_REQUIRED', 'WORK_READY', '10000000-0000-0000-0000-000000000001')$$,
  'SERVICE_ROLE_JOB_INSERT_ALLOW'
);
select extensions.lives_ok(
  $$insert into public.job_confirmation_links (store_id, job_id, evidence_revision, token_hash, expires_at)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 1, repeat('d', 64), now() + interval '1 hour')$$,
  'SERVICE_ROLE_CONFIRMATION_LINK_INSERT_ALLOW'
);
select extensions.throws_ok(
  $$select private.consume_job_confirmation_link('invalid', 'confirmed')$$,
  '22023', null, 'CONFIRMATION_CONSUME_INVALID_TOKEN_DENY'
);
select extensions.lives_ok(
  $$select private.consume_job_confirmation_link(repeat('d', 64), 'confirmed')$$,
  'CONFIRMATION_CONSUME_SERVER_ALLOW'
);
select extensions.results_eq(
  $$select count(*)::bigint from public.job_confirmation_links where token_hash = repeat('d', 64) and consumed_at is not null$$,
  array[1::bigint], 'CONFIRMATION_LINK_CONSUMED_ONCE'
);
select extensions.results_eq(
  $$select private.is_service_os_publication_eligible('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'website', now())$$,
  array[true], 'PUBLICATION_ELIGIBILITY_CONFIRMED_CONSENT_ALLOW'
);
select extensions.throws_ok(
  $$select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'cross-tenant')$$,
  '42501',
  null,
  'REVISION_CROSS_TENANT_DENY'
);

select extensions.throws_ok(
  $$select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'cross-job')$$,
  '42501',
  null,
  'REVISION_CROSS_JOB_DENY'
);

select extensions.results_eq(
  $$select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'service-role-bump')::bigint$$,
  array[2::bigint],
  'SERVICE_ROLE_REVISION_BUMP_ALLOW'
);

select extensions.lives_ok(
  $$insert into public.job_confirmations (store_id, job_id, evidence_revision, outcome)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2, 'confirmed')$$,
  'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW'
);

select * from extensions.finish();
rollback;
