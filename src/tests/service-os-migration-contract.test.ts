import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql'), 'utf8');

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
    expect(writePolicies.length).toBe(3);
    expect(writePolicies.every((policy) => policy.includes('public.is_store_member(store_id)'))).toBe(true);
    expect(migration).toContain('created_by = auth.uid()');
    expect(migration).toContain('uploader_user_id = auth.uid()');
    expect(migration).toContain('j.id = job_evidence_assets.job_id and j.store_id = job_evidence_assets.store_id');
  });

  it('keeps trusted terminal-state mutations behind the server boundary', () => {
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]+(job_confirmations|consent_records|job_payment_requests|content_candidates|brand_sites|brand_site_portfolio_items)[^;]+to authenticated/i);
    expect(migration).toContain('clients cannot self-assert a trusted terminal state');
  });
});
