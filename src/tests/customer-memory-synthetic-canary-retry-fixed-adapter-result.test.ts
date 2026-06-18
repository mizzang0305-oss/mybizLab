import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-synthetic-canary-retry-fixed-adapter-result.md'), 'utf8');
const harness = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');
const adapter = readFileSync(resolve(process.cwd(), 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('synthetic customer-memory canary retry with fixed adapter result', () => {
  it('records the fresh retry approval and exact execute env requested by the owner', () => {
    [
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER',
      '`MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER`',
      '`MYBIZ_CANARY_EXECUTE=true`',
      '`MYBIZ_CANARY_STORE_SLUG=mybizlab-test`',
      '`MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'owner approval present: `true`',
      'requested execute env exactness: `true`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents that the merged harness approval gate blocked before any write', () => {
    [
      'Status: `BLOCKED_EXECUTE_ENV_MISMATCH`',
      'Merged harness approval gate currently accepts:',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY',
      'merged harness approval compatibility: `false`',
      'execute env verified by merged harness: `false`',
      'MYBIZ_CANARY_APPROVAL_REQUIRED',
      'The older harness approval string was not substituted',
      'No write attempt was made because the approval gate failed',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(harness).toContain("approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY'");
    expect(harness).toContain("throw new Error('MYBIZ_CANARY_APPROVAL_REQUIRED')");
  });

  it('keeps the retry result tied to the fixed adapter baseline without invoking the write path', () => {
    [
      'PR #131 merged: adapter projection fix',
      'live customer identifier aligned to `customers.customer_id`',
      '`customers.id` adapter projection removed',
      'fixed server adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      'server adapter write path was not invoked',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(adapter).toContain("select('customer_id,store_id')");
    expect(adapter).not.toContain("select('customer_id,id,store_id')");
  });

  it('records dry-run readiness and the retained PR #130 partial customer baseline', () => {
    [
      'Result: `DRY_RUN_READY_NO_WRITE`',
      '- production DB write: `false`',
      '- public API write call: `false`',
      '| `customers` | `1` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
      'The `customers` pre-count of `1` matches the retained PR #130 partial synthetic customer baseline.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents zero actual DB effect and no second retry or cleanup', () => {
    [
      'Execute attempt count: `0`',
      'Second retry attempt: `false`',
      'Cleanup/delete execution: `false`',
      '| `customers` | `+0 or +1, max 1` | `0` |',
      '| `customer_contacts` | `upsert max 1` | `0` |',
      '| `inquiries` | `insert max 1` | `0` |',
      '| `customer_timeline_events` | `insert max 1~2` | `0` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('forbids public API write routes, wildcard reads, raw PII, external effects, and manual deploy', () => {
    [
      'public API write route call: `false`',
      'ad hoc harness creation: `false`',
      'SQL replay: `false`',
      'migration/db push/repair/apply: `false`',
      'RLS/GRANT/REVOKE execution: `false`',
      'manual deploy: `false`',
      'raw customer row sample output: `false`',
      'raw phone/email/name output: `false`',
      'raw full store id output: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(doc).not.toContain("from('customers').select('*')");
    expect(doc).not.toMatch(/\b010[-\s]?\d{3,4}[-\s]?\d{4}\b/);
  });

  it('requires approval gate alignment before any future retry', () => {
    [
      'Canary retry decision: `BLOCKED_EXECUTE_ENV_MISMATCH`',
      'do not retry until the approval gate is aligned',
      'cleanup of the retained partial synthetic customer remains separately approval-gated',
      'broader PRO/VIP customer-memory rollout remains blocked',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the actual no-write side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      cleanup_executed: false,
      customer_contacts_upsert_count: 0,
      customer_row_sample_output: false,
      customer_timeline_events_insert_count: 0,
      customers_upsert_delta: 0,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_env_verified: false,
      external_notification_sent: false,
      fixed_adapter_used: false,
      inquiries_insert_count: 0,
      live_customer_memory_gate_enabled_persistently: false,
      manual_deploy: false,
      migration_apply: false,
      non_target_table_changed: false,
      owner_approval: true,
      payment_or_webhook_touched: false,
      pr_106_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      real_customer_name_used: false,
      real_email_used: false,
      real_phone_used: false,
      rls_or_grant_executed: false,
      safe_harness_used: true,
      sales_excel_import_touched: false,
      second_retry_attempt: false,
      sql_replay: false,
      store_members_insert_count: 0,
      store_public_pages_insert_count: 0,
      store_subscriptions_insert_count: 0,
      stores_insert_count: 0,
      synthetic_marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      target_row_cap_exceeded: false,
      test_inquiry_created_with_real_data: false,
      test_store_slug: 'mybizlab-test',
    });
  });
});
