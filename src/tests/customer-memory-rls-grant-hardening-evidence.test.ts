import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-rls-grant-hardening-evidence.md');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('customer-memory RLS/grant hardening evidence', () => {
  it('documents every required and related table in the evidence scope', () => {
    for (const tableName of [
      'customers',
      'customer_contacts',
      'inquiries',
      'customer_timeline_events',
      'stores',
      'store_members',
      'store_subscriptions',
      'profiles',
      'lead_capture_requests',
    ]) {
      expect(doc).toContain(`\`${tableName}\``);
    }
  });

  it('records migration history as repaired and does not add another migration file', () => {
    expect(doc).toContain('`20260614_production_baseline_adoption.sql`: remote applied');
    expect(doc).toContain('`20260615075421_customer_memory_schema_alignment.sql`: remote applied');
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
    ]);
  });

  it('records the RLS, grant, and predicate risk decisions', () => {
    expect(doc).toContain('Readiness decision: `BLOCKED_BROAD_ANON_GRANT`');
    expect(doc).toContain('`BLOCKED_BROAD_AUTHENTICATED_GRANT`');
    expect(doc).toContain('`BLOCKED_UNEXPECTED_PRIVILEGE`');
    expect(doc).toContain('## Table RLS Matrix');
    expect(doc).toContain('## Grant Risk Matrix');
    expect(doc).toContain('## Policy Predicate Risk Summary');
    expect(doc).toContain('`is_store_member(target_store_id uuid)`');
  });

  it('keeps the proposed SQL as proposal-only and forbids live changes', () => {
    expect(doc).toContain('Status: `PROPOSAL_ONLY_NOT_EXECUTED`');
    expect(doc).toContain('The following outline is not a migration file and must not be run from this PR');

    for (const forbidden of [
      'RLS policy apply',
      'GRANT/REVOKE',
      'npx supabase db push',
      'npx supabase migration up',
      'npx supabase migration apply',
      'npx supabase migration repair',
      'SQL replay',
      'production DB write',
      'production schema change',
      'live customer memory write',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('documents live write gates as disabled', () => {
    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveCustomerMemoryWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveAiTraceWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveBackgroundJobExecutionEnabled:\s*false/);
    expect(launchGates).toMatch(/livePublicPageEventWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveFeedbackRecordWriteEnabled:\s*false/);

    expect(doc).toContain('`broadDbWriteEnabled=false`');
    expect(doc).toContain('`liveCustomerMemoryWriteEnabled=false`');
  });

  it('states raw PII and row samples are not collected', () => {
    expect(doc).toContain('`SELECT *` was not used.');
    expect(doc).toContain('Row samples were not collected.');
    expect(doc).toContain('Raw customer/contact/message values were not collected.');
    expect(doc).toContain('Raw PII output');
  });

  it('records false side effects for evidence-only work', () => {
    expect(doc).toContain('"production_db_write": false');
    expect(doc).toContain('"production_schema_changed": false');
    expect(doc).toContain('"migration_apply": false');
    expect(doc).toContain('"db_push": false');
    expect(doc).toContain('"migration_repair": false');
    expect(doc).toContain('"sql_replay": false');
    expect(doc).toContain('"rls_or_grant_executed": false');
    expect(doc).toContain('"live_customer_memory_write": false');
    expect(doc).toContain('"sales_excel_import_touched": false');
    expect(doc).toContain('"rls_grant_hardening_evidence_created": true');
  });
});
