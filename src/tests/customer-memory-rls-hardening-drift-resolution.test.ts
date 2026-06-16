import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-rls-hardening-drift-resolution.md');
const migration = readWorkspaceFile('supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');

describe('customer-memory RLS hardening drift resolution', () => {
  it('records the selected decision and all explicit alternatives', () => {
    expect(doc).toContain('Decision: `REPAIR_AS_APPLIED_RECOMMENDED`');

    for (const decision of [
      'REPAIR_AS_APPLIED_RECOMMENDED',
      'REPLACE_WITH_IDEMPOTENT_MIGRATION_REQUIRED',
      'KEEP_BLOCKED_POLICY_MISMATCH',
      'KEEP_BLOCKED_GRANT_MISMATCH',
      'KEEP_BLOCKED_HELPER_FUNCTION_RISK',
    ]) {
      expect(doc).toContain(decision);
    }
  });

  it('documents the migration list and pending hardening migration', () => {
    expect(doc).toContain('`20260614` | yes | yes');
    expect(doc).toContain('`20260615075421` | yes | yes');
    expect(doc).toContain('`20260616070824` | yes | no');
    expect(doc).toContain('supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql');
  });

  it('compares the four target tables and helper function against current state', () => {
    for (const target of ['customers', 'customer_contacts', 'inquiries', 'customer_timeline_events']) {
      expect(doc).toContain(`\`${target}\``);
      expect(migration).toContain(`public.${target}`);
    }

    expect(doc).toContain('`is_store_member(target_store_id uuid)`');
    expect(migration).toContain('public.is_store_member(uuid)');
  });

  it('covers duplicate policy risk and current-state matching evidence', () => {
    expect(doc).toContain('Static duplicate-policy risk');
    expect(doc).toContain('all 12 target policy names already exist');
    expect(doc).toContain('duplicate-policy conflict risk');
    expect(doc).toContain('| Expected policy names already present | 12 |');
    expect(doc).toContain('| Legacy public/ALL policies observed | 0 |');
  });

  it('keeps the proposed repair command as documentation only', () => {
    expect(doc).toContain('npx supabase migration repair 20260616070824 --status applied --linked');
    expect(doc).toContain('The command above is a proposal only. It was not executed in this PR.');
    expect(doc).toContain('Do not replay `20260616070824_customer_memory_rls_grant_hardening.sql`.');
  });

  it('documents forbidden apply, db push, SQL replay, and RLS/grant execution', () => {
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

  it('requires rollback to be based on current pre-state instead of broad rollback SQL', () => {
    expect(doc).toContain('Current-state rollback requirements');
    expect(doc).toContain('Do not use the rollback SQL comments in `20260616070824_customer_memory_rls_grant_hardening.sql` as-is.');
    expect(doc).toContain('restore broader `public`, `anon`, and `authenticated` privileges');
    expect(doc).toContain('preserve the current safer state');
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
    ]) {
      expect(doc).toContain(sideEffect);
    }

    expect(doc).toContain('sales Excel import work');
  });
});
