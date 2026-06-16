import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-test-store-canary-plan.md');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('customer-memory test-store canary plan', () => {
  it('is a docs/tests-only canary plan on the requested branch baseline', () => {
    expect(doc).toContain('Status: `DRAFT_PR_PLAN_ONLY`');
    expect(doc).toContain('Branch: `codex/customer-memory-test-store-canary-plan`');
    expect(doc).toContain('origin/main expected HEAD: `042f34c01e127a1ea26a4d4cfda331fda0d8c214`');
    expect(doc).toContain('Merged prerequisite: PR #122 post-repair RLS/grant evidence');
    expect(doc).toContain('This PR does not execute a production DB write, API write call, live gate enablement, test inquiry save, or environment change.');

    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
  });

  it('documents the test-store decision without production row samples or raw PII', () => {
    expect(doc).toContain('Test store decision: `OWNER_TEST_STORE_REQUIRED`');
    expect(doc).toContain('Production DB lookup mode: `NOT_RUN_NO_OWNER_APPROVAL`');
    expect(doc).toContain('Repo-local demo seed candidates exist, but no production test store alias or `store_id` is selected by this PR.');

    for (const forbidden of [
      '`SELECT *`: forbidden',
      'raw customer/PII output: forbidden',
      'actual customer row samples: forbidden',
      'creating a new test store: forbidden',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('limits the canary scope to one test store and one synthetic inquiry', () => {
    for (const scopeText of [
      'test store count: exactly 1 owner-approved store',
      'synthetic customer/inquiry count: exactly 1',
      'real customer name, phone, or email: forbidden',
      'external message, notification, payment, or webhook: forbidden',
      'sales Excel import and PR #106: forbidden',
    ]) {
      expect(doc).toContain(scopeText);
    }
  });

  it('uses only non-PII synthetic payload markers', () => {
    for (const payloadText of [
      'marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`',
      'customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`',
      'phone: `OMITTED_NOT_REAL_NUMBER`',
      'email: `OMITTED_NOT_REAL_EMAIL`',
      'message: `Non-PII customer-memory canary inquiry for approved test store only.`',
      'raw PII values: forbidden',
    ]) {
      expect(doc).toContain(payloadText);
    }
  });

  it('selects the server adapter path and keeps gate/env/API changes out of this PR', () => {
    for (const writePathText of [
      'Selected planned write path: server customer-memory adapter path',
      '`src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      '`saveCustomer`',
      '`saveCustomerContact`',
      '`saveInquiry`',
      '`appendTimelineEvent`',
      '`customerMemorySpineEnabled` remains true',
      '`broadDbWriteEnabled` requires owner-approved scoped enablement for the canary run',
      '`liveCustomerMemoryWriteEnabled` requires owner-approved scoped enablement for the canary run',
      'Gate changes in this PR: `forbidden`',
      'API write call in this PR: `forbidden`',
      'Env changes in this PR: `forbidden`',
    ]) {
      expect(doc).toContain(writePathText);
    }

    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveCustomerMemoryWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);
  });

  it('caps expected database effects and requires pre/post count comparison', () => {
    for (const effectText of [
      '`customers` upsert: at most 1 row',
      '`customer_contacts` upsert: at most 1 row',
      '`inquiries` insert: at most 1 row',
      '`customer_timeline_events` insert: at most 1-2 rows',
      'pre-count and post-count comparison is required for all four target tables',
      'stop if any count delta exceeds the approved maximum',
    ]) {
      expect(doc).toContain(effectText);
    }
  });

  it('defines sanitized read-back verification and Vercel-protection stop behavior', () => {
    for (const readBackText of [
      'customer card: masked/sanitized customer marker only',
      'inquiry inbox: redacted summary only',
      'timeline: non-PII summary only',
      'raw phone/email/name output: forbidden',
      'store isolation: verify only the approved test store can read the canary rows',
      'If admin read smoke returns Vercel protection 401, stop without bypass or secret and record separate access required.',
    ]) {
      expect(doc).toContain(readBackText);
    }
  });

  it('keeps rollback and cleanup approval-gated', () => {
    for (const rollbackText of [
      'Canary row identity: marker plus owner-approved test `store_id`',
      'cleanup requires separate owner approval',
      'direct DELETE execution in this PR: forbidden',
      'rollback/cleanup execution remains approval-gated',
    ]) {
      expect(doc).toContain(rollbackText);
    }
  });

  it('includes the owner approval checklist and false side-effects JSON', () => {
    for (const checklistText of [
      'approve test store alias or `store_id`',
      'approve synthetic payload',
      'approve server adapter write path',
      'approve live gate enable scope',
      'approve expected row-count limits',
      'approve read-back routes',
      'approve stop conditions',
    ]) {
      expect(doc).toContain(checklistText);
    }

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
      '"test_store_canary_plan_created": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }
  });
});
