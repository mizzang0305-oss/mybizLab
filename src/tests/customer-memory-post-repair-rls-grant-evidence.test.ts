import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-post-repair-rls-grant-evidence.md');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');

describe('customer-memory post-repair RLS/grant evidence', () => {
  it('covers all four target customer-memory tables', () => {
    for (const table of ['customers', 'customer_contacts', 'inquiries', 'customer_timeline_events']) {
      expect(doc).toContain(`\`${table}\``);
    }
  });

  it('records all active migrations as remote applied after repair', () => {
    expect(doc).toContain('`20260614` | yes | yes');
    expect(doc).toContain('`20260615075421` | yes | yes');
    expect(doc).toContain('`20260616070824` | yes | yes');
    expect(doc).toContain('no local-only migration drift was observed');
    expect(doc).toContain('no remote-only migration drift was observed');
  });

  it('documents policy and grant hardening evidence as zero-risk counts', () => {
    expect(doc).toContain('legacy public/ALL policy count: 0');
    expect(doc).toContain('public and anon direct table grant counts are 0');
    expect(doc).toContain('authenticated destructive grant count is 0');
    expect(doc).toContain('Expected command-specific authenticated policy count: 12');
    expect(doc).toContain('Observed matching command-specific authenticated policy count: 12');
  });

  it('documents authenticated privileges and destructive privilege absence', () => {
    expect(doc).toContain('`INSERT`, `SELECT`, `UPDATE`');

    for (const destructivePrivilege of [
      'authenticated `DELETE`: absent',
      'authenticated `TRUNCATE`: absent',
      'authenticated `REFERENCES`: absent',
      'authenticated `TRIGGER`: absent',
    ]) {
      expect(doc).toContain(destructivePrivilege);
    }
  });

  it('documents helper function exposure and security-definer follow-up', () => {
    expect(doc).toContain('`is_store_member(target_store_id uuid)`');
    expect(doc).toContain('| `is_store_member(target_store_id uuid)` | true | true | `search_path=public` | false | false | true | true |');
    expect(doc).toContain('SECURITY DEFINER');
    expect(doc).toContain('follow-up security review list');
  });

  it('keeps live write gates disabled in docs and source defaults', () => {
    for (const gate of [
      'broadDbWriteEnabled=false',
      'liveCustomerMemoryWriteEnabled=false',
      'liveLeadWriteEnabled=false',
      'liveAiTraceWriteEnabled=false',
      'liveBackgroundJobExecutionEnabled=false',
      'livePublicPageEventWriteEnabled=false',
      'liveFeedbackRecordWriteEnabled=false',
    ]) {
      expect(doc).toContain(gate);
    }

    expect(launchGates).toContain('broadDbWriteEnabled: false');
    expect(launchGates).toContain('liveCustomerMemoryWriteEnabled: false');
    expect(launchGates).toContain('liveLeadWriteEnabled: false');
    expect(launchGates).toContain('liveAiTraceWriteEnabled: false');
    expect(launchGates).toContain('liveBackgroundJobExecutionEnabled: false');
    expect(launchGates).toContain('livePublicPageEventWriteEnabled: false');
    expect(launchGates).toContain('liveFeedbackRecordWriteEnabled: false');
  });

  it('records the readiness decision and blocked alternatives', () => {
    expect(doc).toContain('Decision: `POST_REPAIR_RLS_GRANT_EVIDENCE_READY`');

    for (const decision of [
      'POST_REPAIR_RLS_GRANT_EVIDENCE_READY',
      'BLOCKED_MIGRATION_HISTORY_DRIFT',
      'BLOCKED_LEGACY_PUBLIC_POLICY',
      'BLOCKED_ANON_OR_PUBLIC_GRANT',
      'BLOCKED_AUTHENTICATED_DESTRUCTIVE_GRANT',
      'BLOCKED_HELPER_FUNCTION_EXPOSURE',
      'BLOCKED_ADMIN_READ_REGRESSION_RISK',
    ]) {
      expect(doc).toContain(decision);
    }
  });

  it('documents canary prerequisites, rollback posture, and forbidden operations', () => {
    expect(doc).toContain('Canary Prerequisites');
    expect(doc).toContain('Rollback And Stop Conditions');
    expect(doc).toContain('admin customer-memory read smoke remains store-scoped');
    expect(doc).toContain('public inquiry live persistence remains disabled');

    for (const forbidden of [
      'RLS policy apply',
      '`GRANT`',
      '`REVOKE`',
      'production DB write',
      'production schema change',
      '`npx supabase db push`',
      '`npx supabase migration repair`',
      '`npx supabase migration up`',
      '`npx supabase migration apply`',
      'SQL replay',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('does not add a new migration file for this evidence PR', () => {
    const activeMigrations = readdirSync(workspacePath('supabase/migrations')).filter((file) => file.endsWith('.sql'));

    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
  });

  it('records side effects as false and leaves sales Excel import out of scope', () => {
    for (const sideEffect of [
      '"production_db_write": false',
      '"production_schema_changed": false',
      '"migration_apply": false',
      '"db_push": false',
      '"migration_repair": false',
      '"sql_replay": false',
      '"rls_or_grant_executed": false',
      '"live_customer_memory_write": false',
      '"live_lead_write": false',
      '"env_auth_payment_webhook_changed": false',
      '"raw_pii_output": false',
      '"sales_excel_import_touched": false',
      '"post_repair_rls_grant_evidence_created": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }

    expect(doc).toContain('sales Excel import work');
  });
});
