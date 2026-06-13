import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const evidencePack = readWorkspaceFile('docs/lead-capture-migration-evidence-pack.md');
const applyChecklist = readWorkspaceFile('docs/lead-capture-migration-apply-checklist.md');
const liveWriteChecklist = readWorkspaceFile('docs/live-lead-write-enable-checklist.md');
const existingTableDecision = readWorkspaceFile('docs/lead-capture-existing-table-decision.md');
const grantRemediationPlan = readWorkspaceFile('docs/lead-capture-grant-remediation-plan.md');
const migration = readWorkspaceFile('supabase/migrations/20260609_lead_capture_requests.sql');

describe('lead capture migration evidence pack', () => {
  it('documents read-only evidence queries for production readiness', () => {
    expect(evidencePack).toContain('information_schema.tables');
    expect(evidencePack).toContain('information_schema.columns');
    expect(evidencePack).toContain('pg_indexes');
    expect(evidencePack).toContain('relrowsecurity');
    expect(evidencePack).toContain('pg_policies');
    expect(evidencePack).toContain('information_schema.role_table_grants');
    expect(evidencePack).toContain("to_regclass('supabase_migrations.schema_migrations')");
    expect(evidencePack).toContain('matching_migration_count');
    expect(evidencePack).toContain('count(*) as lead_capture_requests_count');
    expect(evidencePack).toContain("table_name = 'store_members'");
    expect(evidencePack).toContain("table_name = 'store_subscriptions'");
    expect(evidencePack).toContain("tc.table_name in ('lead_capture_requests', 'store_members', 'stores', 'profiles')");
    expect(evidencePack).toContain("table_name in ('profiles', 'stores', 'store_members', 'platform_admin_members')");
    expect(evidencePack).toContain("constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')");
    expect(evidencePack).toContain('compatible_existing_table');
    expect(evidencePack).toContain('idempotent_alter_required');
    expect(evidencePack).toContain('blocked_existing_data_or_policy_risk');
    expect(evidencePack).toContain('authenticated destructive or administrative grants');
  });

  it('keeps the evidence pack free of write or mutation commands', () => {
    expect(evidencePack).not.toMatch(/\binsert\s+into\b/i);
    expect(evidencePack).not.toMatch(/\bupdate\s+public\./i);
    expect(evidencePack).not.toMatch(/\bdelete\s+from\b/i);
    expect(evidencePack).not.toMatch(/\bdrop\s+table\b/i);
    expect(evidencePack).not.toMatch(/supabase db push/i);
  });

  it('documents apply gates and rollback as a separate approval path', () => {
    expect(applyChecklist).toContain('This checklist defines the approval gate');
    expect(applyChecklist).toContain('Do not run any command from this section without explicit owner approval');
    expect(applyChecklist).toContain('supabase db push');
    expect(applyChecklist).toContain('drop policy if exists');
    expect(applyChecklist).toContain('drop table if exists public.lead_capture_requests');
    expect(applyChecklist).toContain('If production lead data exists');
    expect(applyChecklist).toContain('FK target columns are verified against production schema evidence');
    expect(applyChecklist).toContain('Existing table path is classified');
    expect(applyChecklist).toContain('public.profiles.id = auth.uid()');
    expect(applyChecklist).toContain('grant remediation is required');
    expect(applyChecklist).toContain('authenticated` has `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES`');
  });

  it('documents live write enablement as separate from migration and RLS apply', () => {
    expect(liveWriteChecklist).toContain('separate from migration apply and RLS policy apply');
    expect(liveWriteChecklist).toContain('Do not combine live lead write enablement with');
    expect(liveWriteChecklist).toContain('leadCapturePersistenceEnabled');
    expect(liveWriteChecklist).toContain('liveLeadWriteEnabled');
    expect(liveWriteChecklist).toContain('"live_lead_write": false');
    expect(liveWriteChecklist).toContain('blocked_existing_data_or_policy_risk');
    expect(liveWriteChecklist).toContain('Broad grant blocker is resolved');
  });

  it('keeps the SQL draft aligned with evidence expectations', () => {
    expect(migration).toMatch(/create table if not exists public\.lead_capture_requests/i);
    expect(migration).toMatch(/alter table public\.lead_capture_requests[\s\S]*add column if not exists store_id uuid null references public\.stores\(store_id\)/i);
    expect(migration).toMatch(/references public\.stores\(store_id\)/i);
    expect(migration).toContain('Reconfirm stores.store_id is the primary key before applying this draft');
    expect(migration).toContain('Do not apply until row_count, columns, indexes, RLS, policies, grants');
    expect(migration).toContain('not valid');
    expect(migration).not.toMatch(/references public\.stores\(id\)/i);
    expect(migration).toMatch(/create index if not exists lead_capture_requests_store_idx/i);
    expect(migration).toMatch(/create trigger trg_lead_capture_requests_set_updated_at/i);
    expect(migration).toMatch(/status text not null default 'new' check/i);
    expect(migration).toMatch(/alter table public\.lead_capture_requests enable row level security/i);
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).not.toMatch(/to anon/i);
  });

  it('records the existing-table migration decision without private row evidence', () => {
    expect(existingTableDecision).toContain('`public.lead_capture_requests` already exists');
    expect(existingTableDecision).toContain('Recommended path: `idempotent_alter_required`');
    expect(existingTableDecision).toContain('migration apply: `BLOCKED`');
    expect(existingTableDecision).toContain('does not prove `profiles.id` is always the same UUID as `auth.uid()`');
    expect(existingTableDecision).toContain('broad `anon` grants are present');
    expect(existingTableDecision).toContain('broad `authenticated` grants are present');
    expect(existingTableDecision).not.toMatch(/select \*/i);
    expect(existingTableDecision).not.toMatch(/customer phone|customer email/i);
  });

  it('documents the broad grant blocker and draft-only remediation plan', () => {
    expect(grantRemediationPlan).toContain('DRAFT ONLY. DO NOT RUN WITHOUT APPROVAL');
    expect(grantRemediationPlan).toContain('revoke all privileges on table public.lead_capture_requests from anon');
    expect(grantRemediationPlan).toContain('revoke all privileges on table public.lead_capture_requests from public');
    expect(grantRemediationPlan).toContain('revoke delete, truncate, trigger, references');
    expect(grantRemediationPlan).toContain('grant select, insert, update');
    expect(grantRemediationPlan).toContain('PR #100 remains Draft');
    expect(grantRemediationPlan).toContain('migration apply remains BLOCKED');
  });
});
