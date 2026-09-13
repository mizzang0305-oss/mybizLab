import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql'), 'utf8');
const rlsRehearsal = readFileSync(resolve(process.cwd(), 'supabase/tests/mybiz_stage2_service_os_rls.sql'), 'utf8');

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

  it('keeps original evidence append-only for merchant clients', () => {
    expect(migration).toMatch(/grant select on table[\s\S]*?public\.job_evidence_assets[\s\S]*?to authenticated/i);
    expect(migration).toMatch(/grant insert on table[\s\S]*?public\.job_evidence_assets[\s\S]*?to authenticated/i);
    expect(migration).not.toMatch(/grant [^;]*update[^;]*job_evidence_assets[^;]*to authenticated/i);
    expect(migration).not.toMatch(/grant [^;]*delete[^;]*job_evidence_assets[^;]*to authenticated/i);
  });

  it('uses tenant predicates for every browser-facing write policy', () => {
    const writePolicies = (migration.match(/create policy [\s\S]*?;/g) ?? []).filter((policy) => /insert|update/.test(policy));
    expect(writePolicies.length).toBe(2);
    expect(writePolicies.every((policy) => policy.includes('public.is_store_member(store_id)'))).toBe(true);
    expect(migration).toContain('created_by = auth.uid()');
    expect(migration).toContain('uploader_user_id = auth.uid()');
    expect(migration).toContain('j.evidence_revision = job_evidence_assets.revision_number');
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
      'CONTRACT_DRAFT_WORK_READY_DENY',
      'PAYMENT_SELF_MARK_PAID_DENY',
      'CUSTOMER_CONFIRMATION_DIRECT_CLIENT_INSERT_DENY',
      'CONSENT_DIRECT_CLIENT_INSERT_DENY',
      'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY',
      'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY',
      'MEDICAL_TEMPLATE_PUBLIC_DEFAULT_DENY',
      'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY',
      'MEMBER_JOB_INSERT_ALLOW',
      'CONTRACT_SENT_WORK_READY_DENY',
      'REVISION_ARBITRARY_INSERT_DENY',
      'REVISION_SKIP_DENY',
      'REVISION_CROSS_TENANT_DENY',
      'INVALID_REVISION_EVIDENCE_DENY',
      'NO_CONTRACT_WORK_READY_ALLOW',
      'CONTRACT_ACCEPTED_WORK_READY_ALLOW',
      'CONTRACT_SIGNED_WORK_READY_ALLOW',
      'MEMBER_HARDENED_EVIDENCE_INSERT_ALLOW',
      'MEMBER_OWN_DATA_SELECT_ALLOW',
      'SERVICE_ROLE_REVISION_BUMP_ALLOW',
      'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW',
    ]) {
      expect(rlsRehearsal).toContain(scenario);
    }
    expect(rlsRehearsal).toContain('Never run this seed against a linked or Production database.');
    expect(rlsRehearsal).toContain('select extensions.plan(25)');
  });
});
