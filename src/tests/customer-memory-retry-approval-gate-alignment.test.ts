import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-retry-approval-gate-alignment.md'), 'utf8');
const script = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory retry approval gate alignment', () => {
  it('records the PR #132 env-mismatch baseline and root cause', () => {
    [
      'PR #132 merged: retry blocked by execute env mismatch.',
      'PR #132 decision: `BLOCKED_EXECUTE_ENV_MISMATCH`.',
      'PR #132 execute attempt count: `0`.',
      'PR #132 production DB write: `false`.',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY',
      'MYBIZ_CANARY_APPROVAL_REQUIRED',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps the initial approval gate and adds the retry approval gate explicitly', () => {
    [
      'approval: APPROVED_TARGET.approval',
      'approval: APPROVED_TARGET.retryApproval',
      "mode: 'initial_canary'",
      "mode: 'retry_with_fixed_adapter'",
      "approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY'",
      "retryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER'",
    ].forEach((expected) => expect(script).toContain(expected));
    expect(doc).toContain('| initial canary | `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY` | not allowed |');
    expect(doc).toContain(
      '| retry with fixed adapter | `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER` | `customers` pre-count `0` or `1` allowed |',
    );
  });

  it('requires execute, approval, slug, and marker without allowing execute-only bypass', () => {
    [
      'MYBIZ_CANARY_EXECUTE=true',
      'MYBIZ_CANARY_STORE_SLUG=mybizlab-test',
      'MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      'MYBIZ_CANARY_STORE_SLUG_MISMATCH',
      'MYBIZ_CANARY_MARKER_MISMATCH',
      'MYBIZ_CANARY_APPROVAL_REQUIRED',
      '`MYBIZ_CANARY_EXECUTE=true` alone is not enough to execute.',
    ].forEach((expected) => expect(doc + script).toContain(expected));
    expect(script).toContain("readEnvValue(env, 'MYBIZ_CANARY_EXECUTE') === 'true'");
    expect(script).toContain("resolveApprovalGate(readEnvValue(env, 'MYBIZ_CANARY_APPROVAL'))");
  });

  it('allows only the retry mode to accept the retained partial customer baseline', () => {
    [
      'allowPartialCustomerBaseline: false',
      'allowPartialCustomerBaseline: true',
      'assertRetryPreCounts',
      'CANARY_RETRY_CUSTOMERS_PRECOUNT_EXCEEDED',
      'CANARY_RETRY_PREEXISTING_ROWS',
      'assertZeroPreCounts(counts)',
      '| `customers` | `0` or `1` allowed |',
      '| `customer_contacts` | `0` expected |',
      '| `inquiries` | `0` expected |',
      '| `customer_timeline_events` | `0` expected |',
    ].forEach((expected) => expect(doc + script).toContain(expected));
  });

  it('documents retry row caps and keeps the harness row-cap enforcement', () => {
    [
      '| `customers` | delta `+0` or `+1`, max `1` |',
      '| `customer_contacts` | upsert max `1` |',
      '| `inquiries` | insert max `1` |',
      '| `customer_timeline_events` | insert max `1~2` |',
      'TARGET_ROW_CAPS',
      'customer_timeline_events: 2',
      'TARGET_ROW_CAP_EXCEEDED',
    ].forEach((expected) => expect(doc + script).toContain(expected));
  });

  it('preserves dry-run default and sanitized output constraints', () => {
    [
      'Dry-run remains the default.',
      'does not call the server adapter write methods',
      'does not perform a production DB write',
      'Dry-run output must not include a raw full `store_id`, raw PII, or customer row samples.',
      "status: 'DRY_RUN_READY_NO_WRITE'",
      'production_db_write: false',
      'store_id_hash',
      'store_id_masked',
    ].forEach((expected) => expect(doc + script).toContain(expected));
  });

  it('keeps the server adapter path only and forbids public API writes and SELECT star', () => {
    [
      'server adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      'does not use `/api/*` public write routes',
      '`SELECT *` is forbidden.',
      "SERVER_ADAPTER_PATH = 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'",
      'createProductionCustomerMemorySchemaAdapter',
      'public_api_write_call: false',
    ].forEach((expected) => expect(doc + script).toContain(expected));
    expect(script).not.toContain("select('*')");
    expect(script).not.toContain('select("*")');
    expect(script).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('states that this PR does not write, retry, clean up, or expose raw private evidence', () => {
    [
      'Production DB write in this PR: `false`.',
      'Canary retry executed in this PR: `false`.',
      'Cleanup/delete executed in this PR: `false`.',
      'raw PII output',
      'customer row sample output',
      'raw full `store_id` output',
      'Ready transition',
      'merge',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the requested side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      approved_store_slug: 'mybizlab-test',
      canary_retry_executed: false,
      cleanup_executed: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      dry_run_default: true,
      env_auth_payment_webhook_changed: false,
      execute_requires_owner_approval: true,
      initial_approval_gate_preserved: true,
      inquiry_row_created: false,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      partial_synthetic_customer_retained: true,
      pr_106_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      retry_approval_gate_aligned: true,
      retry_requires_fresh_owner_approval: true,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      schema_changed: false,
      sql_replay: false,
      synthetic_marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      timeline_row_created: false,
    });
  });
});
