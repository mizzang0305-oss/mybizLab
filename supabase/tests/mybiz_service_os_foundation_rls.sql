-- Local-only pgTAP for the fail-closed Service OS foundation candidate.
-- Synthetic identities and rows only. Never run against a linked database.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
select extensions.plan(55);

set local role postgres;

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'member-a@example.invalid', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'member-b@example.invalid', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'non-member@example.invalid', '{}'::jsonb);

insert into public.profiles(id, full_name, email) values
  ('10000000-0000-0000-0000-000000000001', 'Member A', 'member-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'Member B', 'member-b@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'Non Member', 'non-member@example.invalid');

insert into public.stores(store_id, name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Store A', 'foundation-store-a'),
  ('20000000-0000-0000-0000-000000000002', 'Store B', 'foundation-store-b');

insert into public.store_members(store_id, profile_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner');

insert into public.customers(customer_id, store_id, customer_key) values
  ('25000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'synthetic-customer-a');
insert into public.contracts(id, store_id, status) values
  ('26000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'signed');

insert into public.vertical_templates(id, label, public_v1, medical_mode) values
  ('cleaning', 'Cleaning', true, false),
  ('hair', 'Hair', true, false),
  ('installation', 'Installation', true, false),
  ('wig', 'Wig', false, false),
  ('interior', 'Interior', false, false),
  ('medical', 'Medical', false, true);

insert into public.service_jobs(id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Member A job', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'hair', 'Member B job', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Active confirmation', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Expired confirmation', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Revoked confirmation', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Stale confirmation', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Eligible publication', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Withdrawn publication', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000001', 'cleaning', 'Stale publication', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000001', 'medical', 'Medical publication', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '10000000-0000-0000-0000-000000000001');

insert into public.job_evidence_assets(id, store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'before_photo', 'local', 'stores/20000000-0000-0000-0000-000000000001/jobs/30000000-0000-0000-0000-000000000001/revisions/1/original/40000000-0000-0000-0000-000000000001', 'before.png', 'image/png', 3, repeat('a', 64), 1);

insert into public.job_confirmation_links(store_id, job_id, evidence_revision, token_hash, expires_at, revoked_at) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', 1, repeat('a', 64), timezone('utc', now()) + interval '1 hour', null),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', 1, repeat('b', 64), timezone('utc', now()) - interval '1 hour', null),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', 1, repeat('c', 64), timezone('utc', now()) + interval '1 hour', timezone('utc', now())),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000013', 1, repeat('d', 64), timezone('utc', now()) + interval '1 hour', null);

select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'make-link-stale');

insert into public.job_confirmations(store_id, job_id, evidence_revision, outcome) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000020', 1, 'confirmed'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000021', 1, 'confirmed'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000022', 1, 'confirmed'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000023', 1, 'confirmed');

insert into public.consent_records(store_id, job_id, evidence_revision, purpose, text_version, channels, actor, source, withdrawn_at) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000020', 1, 'website', 'website-v1', array['website'], 'customer', 'secure_link', null),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000021', 1, 'website', 'website-v1', array['website'], 'customer', 'secure_link', timezone('utc', now())),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000022', 1, 'website', 'website-v1', array['website'], 'customer', 'secure_link', null),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000023', 1, 'website', 'website-v1', array['website'], 'customer', 'secure_link', null);

select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', 'make-publication-stale');

insert into public.brand_sites(id, store_id, slug) values
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'brand-a');

-- 1-2: foundation does not activate browser writes.
select extensions.results_eq($$select has_table_privilege('authenticated', 'public.service_jobs', 'INSERT')$$, array[false], 'FOUNDATION_SERVICE_JOB_INSERT_PRIVILEGE_DENY');
select extensions.results_eq($$select has_table_privilege('authenticated', 'public.job_evidence_assets', 'INSERT')$$, array[false], 'FOUNDATION_EVIDENCE_INSERT_PRIVILEGE_DENY');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 3-7: member visibility and tenant isolation.
select extensions.throws_ok($$insert into public.service_jobs(store_id, vertical, service_name, created_by) values ('20000000-0000-0000-0000-000000000001', 'cleaning', 'browser insert', '10000000-0000-0000-0000-000000000001')$$, '42501', null, 'AUTHENTICATED_JOB_INSERT_DENY');
select extensions.throws_ok($$insert into public.job_evidence_assets(store_id, job_id, uploader_user_id, evidence_type, storage_provider, storage_object_key, original_filename, mime_type, size_bytes, sha256, revision_number) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'after_photo', 'local', 'stores/x', 'x.png', 'image/png', 1, repeat('f',64), 1)$$, '42501', null, 'AUTHENTICATED_EVIDENCE_INSERT_DENY');
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='30000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'MEMBER_OWN_JOB_SELECT_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.service_jobs where id='30000000-0000-0000-0000-000000000002'$$, array[0::bigint], 'CROSS_TENANT_JOB_SELECT_DENY');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select extensions.results_eq($$select count(*)::bigint from public.service_jobs$$, array[0::bigint], 'NON_MEMBER_JOB_SELECT_DENY');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 8-19: table privilege boundaries and public template visibility.
set local role anon;
select extensions.throws_ok($$select count(*) from public.service_jobs$$, '42501', null, 'ANON_JOB_SELECT_DENY');
set local role authenticated;
select extensions.throws_ok($$select token_hash from public.job_confirmation_links$$, '42501', null, 'TOKEN_HASH_AUTHENTICATED_READ_DENY');
set local role anon;
select extensions.throws_ok($$select token_hash from public.job_confirmation_links$$, '42501', null, 'TOKEN_HASH_ANON_READ_DENY');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select extensions.throws_ok($$update public.job_evidence_assets set metadata='{"forged":true}'::jsonb where id='40000000-0000-0000-0000-000000000001'$$, '42501', null, 'ORIGINAL_EVIDENCE_UPDATE_DENY');
select extensions.throws_ok($$delete from public.job_evidence_assets where id='40000000-0000-0000-0000-000000000001'$$, '42501', null, 'ORIGINAL_EVIDENCE_DELETE_DENY');
select extensions.throws_ok($$insert into public.job_evidence_revisions(store_id, job_id, revision_number, created_by) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',99,'10000000-0000-0000-0000-000000000001')$$, '42501', null, 'REVISION_DIRECT_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.job_payment_requests(store_id, job_id, status) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PAYMENT_PAID')$$, '42501', null, 'PAYMENT_TERMINAL_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.job_confirmations(store_id, job_id, evidence_revision, outcome) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'confirmed')$$, '42501', null, 'CONFIRMATION_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.consent_records(store_id, job_id, evidence_revision, purpose, text_version, actor, source) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'website','v1','customer','secure_link')$$, '42501', null, 'CONSENT_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.content_candidates(store_id, job_id, evidence_revision, channel) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'website')$$, '42501', null, 'CONTENT_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.brand_sites(store_id, slug) values ('20000000-0000-0000-0000-000000000001','forged')$$, '42501', null, 'BRAND_SITE_CLIENT_INSERT_DENY');
select extensions.throws_ok($$insert into public.brand_site_portfolio_items(store_id, brand_site_id, job_id, evidence_revision, title, summary) values ('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'x','x')$$, '42501', null, 'PORTFOLIO_CLIENT_INSERT_DENY');
select extensions.results_eq($$select string_agg(id, ',' order by id) from public.vertical_templates$$, array['cleaning,hair,installation'::text], 'PUBLIC_V1_TEMPLATE_SELECT_EXACT');

set local role service_role;

-- 20-32: constraints, revision initialization and contention authorization.
select extensions.throws_ok($$insert into public.vertical_templates(id,label,public_v1,medical_mode) values ('medical','Forged medical',true,true)$$, '23514', null, 'MEDICAL_PUBLIC_TEMPLATE_DENY');
select extensions.throws_ok($$insert into public.service_jobs(store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('20000000-0000-0000-0000-000000000001','cleaning','Draft',true,'DRAFT','WORK_READY','10000000-0000-0000-0000-000000000001')$$, '23514', null, 'CONTRACT_DRAFT_WORK_READY_DENY');
select extensions.throws_ok($$insert into public.service_jobs(store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('20000000-0000-0000-0000-000000000001','cleaning','Sent',true,'SENT','WORK_READY','10000000-0000-0000-0000-000000000001')$$, '23514', null, 'CONTRACT_SENT_WORK_READY_DENY');
select extensions.lives_ok($$insert into public.service_jobs(store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('20000000-0000-0000-0000-000000000001','cleaning','Accepted',true,'ACCEPTED','WORK_READY','10000000-0000-0000-0000-000000000001')$$, 'CONTRACT_ACCEPTED_WORK_READY_ALLOW');
select extensions.lives_ok($$insert into public.service_jobs(store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('20000000-0000-0000-0000-000000000001','cleaning','Signed',true,'SIGNED','WORK_READY','10000000-0000-0000-0000-000000000001')$$, 'CONTRACT_SIGNED_WORK_READY_ALLOW');
select extensions.lives_ok($$insert into public.service_jobs(store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('20000000-0000-0000-0000-000000000001','cleaning','No contract',false,'NOT_REQUIRED','WORK_READY','10000000-0000-0000-0000-000000000001')$$, 'NO_CONTRACT_WORK_READY_ALLOW');
select extensions.lives_ok($$insert into public.service_jobs(id,store_id,vertical,service_name,requires_contract,contract_state,state,created_by) values ('30000000-0000-0000-0000-000000000030','20000000-0000-0000-0000-000000000001','cleaning','Service job',false,'NOT_REQUIRED','WORK_COMPLETED','10000000-0000-0000-0000-000000000001')$$, 'SERVICE_ROLE_JOB_INSERT_ALLOW');
select extensions.results_eq($$select count(*)::bigint from public.job_evidence_revisions where job_id='30000000-0000-0000-0000-000000000030' and revision_number=1$$, array[1::bigint], 'INITIAL_REVISION_ONE_CREATED');
select extensions.results_eq($$select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000001','next')::bigint$$, array[2::bigint], 'REVISION_CURRENT_ONE_TO_NEXT_TWO_ALLOW');
select extensions.results_eq($$select evidence_revision::bigint from public.service_jobs where id='30000000-0000-0000-0000-000000000030'$$, array[2::bigint], 'REVISION_CURRENT_STATE_TWO');
select extensions.results_eq($$select count(distinct revision_number)::bigint from public.job_evidence_revisions where job_id='30000000-0000-0000-0000-000000000030'$$, array[2::bigint], 'REVISION_NUMBERS_UNIQUE');
select extensions.throws_ok($$select private.create_next_job_evidence_revision('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','cross-store')$$, '42501', null, 'REVISION_CROSS_STORE_DENY');
select extensions.lives_ok($$insert into public.job_payment_requests(store_id,job_id,status,amount) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PAYMENT_PAID',1000)$$, 'SERVICE_ROLE_PAYMENT_TERMINAL_ALLOW');

-- 33-39: secure confirmation-link consumption.
select extensions.lives_ok($$select private.consume_job_confirmation_link(repeat('a',64),'confirmed','Synthetic customer','{}'::jsonb)$$, 'CONFIRMATION_ACTIVE_TOKEN_ALLOW');
select extensions.results_eq($$select state from public.service_jobs where id='30000000-0000-0000-0000-000000000010'$$, array['CUSTOMER_CONFIRMED'::text], 'CONFIRMATION_UPDATES_JOB_STATE');
select extensions.results_eq($$select payment_state from public.service_jobs where id='30000000-0000-0000-0000-000000000010'$$, array['PAYMENT_NOT_REQUESTED'::text], 'CONFIRMATION_DOES_NOT_SET_PAYMENT_PAID');
select extensions.throws_ok($$select private.consume_job_confirmation_link(repeat('a',64),'confirmed',null,'{}'::jsonb)$$, '22023', null, 'CONFIRMATION_REPLAY_DENY');
select extensions.throws_ok($$select private.consume_job_confirmation_link(repeat('b',64),'confirmed',null,'{}'::jsonb)$$, '22023', null, 'CONFIRMATION_EXPIRED_DENY');
select extensions.throws_ok($$select private.consume_job_confirmation_link(repeat('c',64),'confirmed',null,'{}'::jsonb)$$, '22023', null, 'CONFIRMATION_REVOKED_DENY');
select extensions.throws_ok($$select private.consume_job_confirmation_link(repeat('d',64),'confirmed',null,'{}'::jsonb)$$, '22023', null, 'CONFIRMATION_STALE_REVISION_DENY');

-- 40-47: publication and portfolio enforcement.
select extensions.throws_ok($$insert into public.job_confirmation_links(store_id,job_id,evidence_revision,token_hash,expires_at) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',1,repeat('e',64),timezone('utc',now())+interval '1 hour')$$, '23503', null, 'CONFIRMATION_LINK_CROSS_STORE_DENY');
select extensions.lives_ok($$insert into public.content_candidates(id,store_id,job_id,evidence_revision,channel,status,merchant_approved_at) values ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000020',1,'website','APPROVED',timezone('utc',now()))$$, 'CONTENT_ELIGIBLE_APPROVED_ALLOW');
select extensions.throws_ok($$update public.content_candidates set status='PUBLISHED' where id='60000000-0000-0000-0000-000000000001'$$, '23514', null, 'CONTENT_PUBLISHED_REQUIRES_PROVIDER_RECEIPT');
select extensions.lives_ok($$update public.content_candidates set status='PUBLISHED',provider_receipt='{"provider":"synthetic-ci","receipt":"present"}'::jsonb where id='60000000-0000-0000-0000-000000000001'$$, 'CONTENT_PUBLISHED_WITH_RECEIPT_ALLOW');
select extensions.throws_ok($$insert into public.content_candidates(store_id,job_id,evidence_revision,channel,status,merchant_approved_at) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000021',1,'website','APPROVED',timezone('utc',now()))$$, '23514', null, 'WITHDRAWN_CONSENT_PUBLICATION_DENY');
select extensions.throws_ok($$insert into public.content_candidates(store_id,job_id,evidence_revision,channel,status,merchant_approved_at) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000022',1,'website','APPROVED',timezone('utc',now()))$$, '23514', null, 'STALE_REVISION_PUBLICATION_DENY');
select extensions.throws_ok($$insert into public.content_candidates(store_id,job_id,evidence_revision,channel,status,merchant_approved_at) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000023',1,'website','APPROVED',timezone('utc',now()))$$, '23514', null, 'MEDICAL_PUBLICATION_DENY');
select extensions.throws_ok($$insert into public.brand_site_portfolio_items(store_id,brand_site_id,job_id,evidence_revision,content_candidate_id,title,summary,status,published_at) values ('20000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000020',1,'60000000-0000-0000-0000-000000000001','Cross','Cross','published',timezone('utc',now()))$$, '23514', null, 'PORTFOLIO_CROSS_STORE_DENY');
select extensions.lives_ok($$insert into public.brand_site_portfolio_items(store_id,brand_site_id,job_id,evidence_revision,content_candidate_id,title,summary,status,published_at) values ('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000020',1,'60000000-0000-0000-0000-000000000001','Eligible','Eligible','published',timezone('utc',now()))$$, 'PORTFOLIO_ELIGIBLE_PUBLISHED_ALLOW');

-- 48-55: catalog-level RLS/grant/secret-column matrix.
select extensions.results_eq($$select state from public.service_jobs where id='30000000-0000-0000-0000-000000000022'$$, array['CONFIRMATION_OUTDATED'::text], 'REVISION_AFTER_CONFIRMATION_MARKS_OUTDATED');
select extensions.results_eq($$select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates']) and c.relrowsecurity$$, array[11::bigint], 'ALL_STAGE2_TABLES_RLS_ENABLED');
select extensions.results_eq($$select count(*)::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates']) and c.relforcerowsecurity$$, array[11::bigint], 'ALL_STAGE2_TABLES_RLS_FORCED');
select extensions.results_eq($$select count(*)::bigint from pg_policies where schemaname='public' and tablename=any(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates'])$$, array[10::bigint], 'FOUNDATION_SELECT_POLICY_COUNT_EXACT');
select extensions.results_eq($$select count(*)::bigint from unnest(array['service_jobs','job_evidence_assets','job_evidence_revisions','job_confirmations','job_confirmation_links','consent_records','job_payment_requests','content_candidates','brand_sites','brand_site_portfolio_items','vertical_templates']) t(name) where has_table_privilege('service_role','public.'||name,'SELECT') and has_table_privilege('service_role','public.'||name,'INSERT') and has_table_privilege('service_role','public.'||name,'UPDATE') and has_table_privilege('service_role','public.'||name,'DELETE')$$, array[11::bigint], 'SERVICE_ROLE_TABLE_BOUNDARY_ALLOW');
select extensions.results_eq($$select count(*)::bigint from information_schema.columns where table_schema='public' and table_name='job_confirmation_links' and column_name in ('raw_token','token')$$, array[0::bigint], 'RAW_CONFIRMATION_TOKEN_COLUMN_ABSENT');

select * from extensions.finish();
rollback;
