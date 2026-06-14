import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const plan = readWorkspaceFile('docs/lead-capture-migration-history-reconciliation-plan.md');
const migration = readWorkspaceFile(
  'supabase/migrations_archive/pre_baseline_20260614/20260609_lead_capture_requests.sql',
);
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');

describe('lead capture migration history reconciliation plan', () => {
  it('records migration-history evidence without approving a metadata write', () => {
    expect(plan).toContain('read-only reconciliation plan for PR #102');
    expect(plan).toContain('Origin main HEAD: `ee212ff75fe6307cfc922517f9ba281179b121fc`');
    expect(plan).toContain('Supabase MCP `_list_migrations`: `[]`');
    expect(plan).toContain('Local migration version candidate:');
    expect(plan).toContain('`20260609`');
    expect(plan).toContain('separate approval');
    expect(plan).toContain('metadata write');
  });

  it('classifies schema-ready migration-history drift as repair-required', () => {
    expect(plan).toContain('Current classification: `MIGRATION_REPAIR_REQUIRED`');
    expect(plan).toContain('Why not `NO_ACTION_NEEDED`');
    expect(plan).toContain('Why not `CONTROLLED_IDEMPOTENT_APPLY_REQUIRED`');
    expect(plan).toContain('Standard migration apply decision: `BLOCKED_STANDARD_MIGRATION_APPLY`');
    expect(plan).toContain('production schema target state | MATCHES_TARGET_EVIDENCE');
  });

  it('documents the candidate repair command but blocks execution in this PR', () => {
    expect(plan).toContain('Proposed Command, Not Executed');
    expect(plan).toContain('supabase migration repair 20260609 --status applied --linked');
    expect(plan).toContain('Do not run this command from PR #102');
    expect(plan).toContain('should not replay the SQL migration body');
    expect(plan).toContain('requires a separate explicit approval');
  });

  it('keeps live writes and direct schema changes out of scope', () => {
    expect(plan).toContain('production migration apply, RLS policy apply, GRANT/REVOKE');
    expect(plan).toContain('live lead writes, live customer memory writes');
    expect(plan).toContain('RLS policy apply/change | BLOCKED');
    expect(plan).toContain('GRANT/REVOKE | BLOCKED');
    expect(plan).toContain('live lead write enablement | BLOCKED');

    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/leadCapturePersistenceEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);
  });

  it('compares against the reviewed lead capture migration artifact', () => {
    expect(migration).toContain('create table if not exists public.lead_capture_requests');
    expect(migration).toContain('references public.stores(store_id)');
    expect(migration).toContain('alter column source set not null');
    expect(migration).toContain('create trigger trg_lead_capture_requests_set_updated_at');
    expect(migration).toContain('alter table public.lead_capture_requests enable row level security');
    expect(migration).toContain('create policy "lead_capture_requests_platform_admin_select"');
    expect(migration).toContain('no delete policy');
  });

  it('surfaces out-of-scope RLS advisory without auto-remediation', () => {
    expect(plan).toContain('Out-of-Scope Security Advisory');
    expect(plan).toContain('some unrelated public tables have RLS disabled');
    expect(plan).toContain('no remediation SQL was run');
    expect(plan).toContain('separate security-hardening review');
  });
});
