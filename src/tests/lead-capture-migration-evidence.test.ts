import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const evidencePack = readWorkspaceFile('docs/lead-capture-migration-evidence-pack.md');
const applyChecklist = readWorkspaceFile('docs/lead-capture-migration-apply-checklist.md');
const liveWriteChecklist = readWorkspaceFile('docs/live-lead-write-enable-checklist.md');
const migration = readWorkspaceFile('supabase/migrations/20260609_lead_capture_requests.sql');

describe('lead capture migration evidence pack', () => {
  it('documents read-only evidence queries for production readiness', () => {
    expect(evidencePack).toContain('information_schema.tables');
    expect(evidencePack).toContain('information_schema.columns');
    expect(evidencePack).toContain('pg_indexes');
    expect(evidencePack).toContain('relrowsecurity');
    expect(evidencePack).toContain('pg_policies');
    expect(evidencePack).toContain('information_schema.role_table_grants');
    expect(evidencePack).toContain('supabase_migrations.schema_migrations');
    expect(evidencePack).toContain('count(*) as lead_capture_requests_count');
    expect(evidencePack).toContain("table_name = 'store_members'");
    expect(evidencePack).toContain("table_name = 'store_subscriptions'");
    expect(evidencePack).toContain("tc.table_name in ('lead_capture_requests', 'store_members', 'stores', 'profiles')");
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
  });

  it('documents live write enablement as separate from migration and RLS apply', () => {
    expect(liveWriteChecklist).toContain('separate from migration apply and RLS policy apply');
    expect(liveWriteChecklist).toContain('Do not combine live lead write enablement with');
    expect(liveWriteChecklist).toContain('leadCapturePersistenceEnabled');
    expect(liveWriteChecklist).toContain('liveLeadWriteEnabled');
    expect(liveWriteChecklist).toContain('"live_lead_write": false');
  });

  it('keeps the SQL draft aligned with evidence expectations', () => {
    expect(migration).toMatch(/create table if not exists public\.lead_capture_requests/i);
    expect(migration).toMatch(/create index if not exists lead_capture_requests_store_idx/i);
    expect(migration).toMatch(/create trigger trg_lead_capture_requests_set_updated_at/i);
    expect(migration).toMatch(/status text not null default 'new' check/i);
    expect(migration).toMatch(/alter table public\.lead_capture_requests enable row level security/i);
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).not.toMatch(/to anon/i);
  });
});
