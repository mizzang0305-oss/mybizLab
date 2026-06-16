import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-schema-alignment-preapply-evidence.md');
const pendingMigration = readWorkspaceFile(
  'supabase/migrations/20260615075421_customer_memory_schema_alignment.sql',
);
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('customer-memory schema alignment pre-apply evidence', () => {
  it('documents the pending schema alignment migration while later hardening drafts are active', () => {
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
    expect(existsSync(workspacePath('supabase/migrations/20260615075421_customer_memory_schema_alignment.sql'))).toBe(
      true,
    );
    expect(doc).toContain('Pending migration under review: `supabase/migrations/20260615075421_customer_memory_schema_alignment.sql`');
    expect(doc).toContain('`20260615075421` | empty | customer-memory schema alignment remains local-only pending');
    expect(pendingMigration).toContain('DRAFT ONLY');
  });

  it('records a readiness decision and keeps apply unexecuted', () => {
    expect(doc).toContain('Readiness decision: `SCHEMA_ALIGNMENT_APPLY_READY`');
    expect(doc).toContain('Apply status: `NOT_EXECUTED`');
    expect(doc).toContain('RLS/grant hardening is still required before live write');
  });

  it('keeps db push, apply, repair, RLS/grant, and live writes forbidden', () => {
    expect(doc).toContain('`npx supabase db push`');
    expect(doc).toContain('`npx supabase migration up`');
    expect(doc).toContain('`npx supabase migration apply`');
    expect(doc).toContain('`npx supabase migration repair`');
    expect(doc).toContain('SQL replay');
    expect(doc).toContain('RLS policy apply');
    expect(doc).toContain('GRANT/REVOKE');
    expect(doc).toContain('live customer memory write');
    expect(doc).toContain('production DB schema change');
    expect(doc).toContain('production business row write');
  });

  it('includes duplicate, orphan, null, RLS, grant, and rollback audit sections', () => {
    expect(doc).toContain('## Dedupe And Backfill Risk Audit');
    expect(doc).toContain('customers_store_normalized_phone_duplicate_groups');
    expect(doc).toContain('customer_contacts_store_phone_duplicate_groups');
    expect(doc).toContain('customer_contacts_store_email_duplicate_groups');
    expect(doc).toContain('customer_contacts_orphan_customer_id_count');
    expect(doc).toContain('customer_contacts_store_id_null_count');
    expect(doc).toContain('customer_contacts_phone_normalized_null_or_blank_count');
    expect(doc).toContain('customer_contacts_email_normalized_null_or_blank_count');
    expect(doc).toContain('## RLS And Grant Risk Audit');
    expect(doc).toContain('SEPARATE_HARDENING_REQUIRED_BEFORE_LIVE_WRITE');
    expect(doc).toContain('## Rollback Plan');
  });

  it('states raw PII and row samples are not collected', () => {
    expect(doc).toContain('`SELECT *` was not used.');
    expect(doc).toContain('Row samples were not collected.');
    expect(doc).toContain('Raw customer/contact/message values were not collected.');
    expect(doc).toContain('raw PII output');
  });

  it('records false side effects for pre-apply evidence only', () => {
    expect(doc).toContain('"production_db_write": false');
    expect(doc).toContain('"production_schema_changed": false');
    expect(doc).toContain('"migration_apply": false');
    expect(doc).toContain('"db_push": false');
    expect(doc).toContain('"migration_repair": false');
    expect(doc).toContain('"sql_replay": false');
    expect(doc).toContain('"rls_or_grant_executed": false');
    expect(doc).toContain('"live_customer_memory_write": false');
    expect(doc).toContain('"schema_alignment_preapply_evidence_created": true');
  });
});
