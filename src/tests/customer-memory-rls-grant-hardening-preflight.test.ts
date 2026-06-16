import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-rls-grant-hardening-preflight.md');
const migration = readWorkspaceFile('supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');

describe('customer-memory RLS/grant hardening preflight evidence', () => {
  it('documents the pending target migration and migration list state', () => {
    expect(doc).toContain('supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql');
    expect(doc).toContain('`20260614` | yes | yes');
    expect(doc).toContain('`20260615075421` | yes | yes');
    expect(doc).toContain('`20260616070824` | yes | no');
    expect(doc).toContain('local-only pending');
  });

  it('covers the four target customer-memory tables and helper function', () => {
    for (const target of ['customers', 'customer_contacts', 'inquiries', 'customer_timeline_events']) {
      expect(doc).toContain(`\`${target}\``);
      expect(migration).toContain(`public.${target}`);
    }

    expect(doc).toContain('`is_store_member`');
    expect(migration).toContain('public.is_store_member(uuid)');
  });

  it('records the pending SQL scope and excludes destructive table/data operations', () => {
    expect(doc).toContain('`DROP TABLE` | absent');
    expect(doc).toContain('table `TRUNCATE` statement | absent');
    expect(doc).toContain('data `DELETE FROM` | absent');
    expect(doc).toContain('data `UPDATE` | absent');
    expect(doc).toContain('RLS policy changes | present and expected');
    expect(doc).toContain('`GRANT`/`REVOKE` statements | present and expected');

    expect(migration).not.toMatch(/\bdrop\s+table\b/i);
    expect(migration).not.toMatch(/\btruncate\s+(?:table\s+)?public\./i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\./i);
    expect(migration).not.toMatch(/\bupdate\s+public\./i);
  });

  it('includes production pre-state evidence sections without row samples or raw PII', () => {
    for (const heading of [
      '## Production Pre-State Evidence',
      'Count-only row state',
      'RLS state',
      'Policy summary',
      'Grant summary',
      'Destructive privilege summary',
      'Helper function evidence',
    ]) {
      expect(doc).toContain(heading);
    }

    expect(doc).toContain('`SELECT *` was not used.');
    expect(doc).toContain('Row samples were not collected.');
    expect(doc).toContain('Raw customer/contact/message values were not collected.');
    expect(doc).toContain('Raw PII, secrets, tokens, DB passwords, and connection strings were not output.');
  });

  it('captures the unexpected pre-state mismatch readiness decision', () => {
    expect(doc).toContain('Readiness decision: `BLOCKED_UNEXPECTED_MIGRATION_DRIFT`');
    expect(doc).toContain('production catalog metadata already appears to match the pending hardening effect');
    expect(doc).toContain('applying the migration as-is is expected to hit duplicate-policy conflicts');
    expect(doc).toContain('the same 12 policy names already exist');
    expect(doc).not.toContain('Readiness decision: `RLS_GRANT_HARDENING_APPLY_READY`');
  });

  it('documents apply impact, rollback, owner approval, post-apply evidence, and canary gates', () => {
    for (const section of [
      '## Apply Impact Matrix',
      '## Rollback Plan',
      '## Owner Approval Checklist',
      '## Post-Apply Evidence Checklist',
      '## Canary Prerequisites',
    ]) {
      expect(doc).toContain(section);
    }

    expect(doc).toContain('rollback outline does not match the current safer pre-state');
    expect(doc).toContain('Rollback requires separate owner approval.');
    expect(doc).toContain('Do not run the current draft SQL as-is');
  });

  it('keeps apply, db push, repair, RLS/grant execution, and live writes forbidden', () => {
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
      'live customer-memory write',
      'live lead write',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('documents live gates as disabled in the preflight and source', () => {
    for (const gate of [
      'broadDbWriteEnabled',
      'liveCustomerMemoryWriteEnabled',
      'liveLeadWriteEnabled',
      'liveAiTraceWriteEnabled',
      'liveBackgroundJobExecutionEnabled',
      'livePublicPageEventWriteEnabled',
      'liveFeedbackRecordWriteEnabled',
    ]) {
      expect(doc).toContain(`\`${gate}=false\``);
      expect(launchGates).toMatch(new RegExp(`${gate}:\\s*false`));
    }
  });

  it('records false side effects for preflight-only work', () => {
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
      '"rls_grant_hardening_preflight_created": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }
  });
});
