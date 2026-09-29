import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql'), 'utf8');
const rlsRehearsal = readFileSync(resolve(process.cwd(), 'supabase/tests/mybiz_stage2_service_os_rls.sql'), 'utf8');
const baseline = readFileSync(resolve(process.cwd(), 'supabase/baselines/current_production_schema_v1/current_schema_candidate_v4.sql'), 'utf8');
const currentAcl = baseline.split('-- FINAL APPLICATION ACL NORMALIZATION SECTION')[1]?.split('-- END FINAL APPLICATION ACL NORMALIZATION SECTION')[0] ?? '';

describe('MyBiz Service OS migration draft', () => {
  it('is explicitly draft-only and additive', () => {
    expect(migration).toContain('DRAFT ONLY');
    expect(migration).toContain('Production execution');
    expect(migration).not.toMatch(/drop table|truncate table|delete from/i);
  });

  it('models the Stage 2 domains separately and enables RLS for every table', () => {
    for (const table of ['service_jobs', 'job_evidence_assets', 'job_evidence_revisions', 'job_confirmations', 'job_confirmation_links', 'consent_records', 'job_payment_requests', 'content_candidates', 'brand_sites', 'brand_site_portfolio_items', 'vertical_templates']) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('does not expose secure confirmation token hashes to browser roles', () => {
    expect(migration).toContain('token_hash text not null unique');
    expect(migration).not.toMatch(/grant [^;]+job_confirmation_links[^;]+ to (anon|authenticated)/i);
    expect(migration).toMatch(/grant all privileges on table[\s\S]+job_confirmation_links[\s\S]+to service_role/i);
  });

  it('keeps current merchant evidence access read-only', () => {
    expect(currentAcl).toContain('GRANT SELECT ON TABLE "public"."job_evidence_assets" TO "authenticated";');
    expect(currentAcl).toContain('GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_evidence_assets" TO "service_role";');
    expect(currentAcl).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON TABLE "public"\."job_evidence_assets" TO "authenticated";/);
  });

  it('uses current Production read-only authenticated ACL across Stage 2 tables', () => {
    for (const table of ['service_jobs', 'job_evidence_assets', 'job_evidence_revisions', 'job_confirmations', 'consent_records', 'job_payment_requests', 'content_candidates', 'brand_sites', 'vertical_templates']) {
      expect(currentAcl).toContain(`REVOKE ALL PRIVILEGES ON TABLE "public"."${table}" FROM PUBLIC, anon, authenticated, service_role;`);
      expect(currentAcl).toContain(`GRANT SELECT ON TABLE "public"."${table}" TO "authenticated";`);
      expect(currentAcl).not.toMatch(new RegExp(`GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON TABLE "public"\\."${table}" TO "authenticated";`));
    }
    expect(currentAcl).not.toContain('GRANT SELECT ON TABLE "public"."job_confirmation_links" TO "authenticated";');
  });

  it('enforces contract acceptance before work-ready or later states', () => {
    expect(migration).toMatch(/state in \('JOB_CREATED', 'CONTRACT_REQUIRED'\)[\s\S]*?or not requires_contract[\s\S]*?or contract_state in \('ACCEPTED', 'SIGNED'\)/);
    expect(migration).toContain("state in ('JOB_CREATED', 'CONTRACT_REQUIRED', 'WORK_READY')");
  });

  it('makes revision creation atomic and server-controlled', () => {
    expect(migration).not.toMatch(/grant insert on table[^;]*job_evidence_revisions[^;]*to authenticated/i);
    expect(migration).not.toContain('create policy evidence_revisions_member_insert');
    expect(migration).toContain('create or replace function private.create_next_job_evidence_revision');
    expect(migration).toMatch(/security definer\s+set search_path = ''/i);
    expect(migration).toContain('for update;');
    expect(migration).toContain('unique (job_id, revision_number, store_id)');
    expect(migration).toContain('foreign key (job_id, revision_number, store_id)');
  });

  it('binds confirmation links to one current revision and consumes them once', () => {
    expect(migration).toContain('consumed_at timestamptz');
    expect(migration).toContain('create or replace function private.consume_job_confirmation_link');
    expect(migration).toContain('v_link.consumed_at is not null');
    expect(migration).toContain('j.evidence_revision = v_link.evidence_revision');
    expect(migration).toContain('unique (job_id, evidence_revision)');
  });

  it('keeps trusted terminal-state mutations behind the server boundary', () => {
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]+(job_confirmations|consent_records|job_payment_requests|content_candidates|brand_sites|brand_site_portfolio_items)[^;]+to authenticated/i);
    expect(migration).toContain('clients cannot self-assert a trusted terminal state');
  });

  it('ships the complete local-only positive and negative RLS rehearsal matrix', () => {
    for (const scenario of [
      'CROSS_TENANT_SELECT_DENY',
      'CROSS_TENANT_INSERT_DENY',
      'CONTRACT_DRAFT_DIRECT_INSERT_DENY',
      'PAYMENT_SELF_MARK_PAID_DENY',
      'CONFIRMATION_DIRECT_CLIENT_INSERT_DENY',
      'CONSENT_DIRECT_CLIENT_INSERT_DENY',
      'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY',
      'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY',
      'MEDICAL_PUBLIC_DEFAULT_DENY',
      'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY',
      'MEMBER_JOB_DIRECT_INSERT_DENY',
      'CONTRACT_SENT_DIRECT_INSERT_DENY',
      'REVISION_ARBITRARY_INSERT_DENY',
      'REVISION_SKIP_DENY',
      'REVISION_CROSS_TENANT_DENY',
      'INVALID_REVISION_EVIDENCE_DENY',
      'NO_CONTRACT_DIRECT_INSERT_DENY',
      'CONTRACT_ACCEPTED_DIRECT_INSERT_DENY',
      'CONTRACT_SIGNED_DIRECT_INSERT_DENY',
      'MEMBER_EVIDENCE_DIRECT_INSERT_DENY',
      'MEMBER_OWN_DATA_SELECT_ALLOW',
      'MEMBER_OWN_EVIDENCE_READ_ALLOW',
      'SERVICE_ROLE_JOB_INSERT_ALLOW',
      'SERVICE_ROLE_REVISION_BUMP_ALLOW',
      'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW',
      'CONFIRMATION_CONSUME_SERVER_ALLOW',
    ]) {
      expect(rlsRehearsal).toContain(scenario);
    }
    expect(rlsRehearsal).toContain('Never run this seed against a linked or Production database.');
    expect(rlsRehearsal).toContain('select extensions.plan(48)');
  });
});
