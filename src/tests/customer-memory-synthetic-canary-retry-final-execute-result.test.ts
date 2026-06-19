import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-synthetic-canary-retry-final-execute-result.md'), 'utf8');
const harness = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');
const adapter = readFileSync(resolve(process.cwd(), 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('synthetic customer-memory canary retry final execute result', () => {
  it('records the owner approval, exact execute env, marker, and dedicated store slug', () => {
    [
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER',
      '`MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER`',
      '`MYBIZ_CANARY_EXECUTE=true`',
      '`MYBIZ_CANARY_STORE_SLUG=mybizlab-test`',
      '`MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'owner approval present: `true`',
      'execute env exactness: `true`',
      'retry approval gate aligned: `true`',
      'initial approval gate preserved: `true`',
      'synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('uses the merged safe harness, aligned retry gate, and fixed server adapter path only', () => {
    [
      'safe merged harness: `scripts/customer-memory/synthetic-canary-harness.mjs`',
      'fixed server adapter path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      'execute mode: `retry_with_fixed_adapter`',
      'server adapter write path was invoked for the approved test store only',
      'public API write route call: `false`',
      'ad hoc harness creation: `false`',
      'SQL replay: `false`',
      'migration/db push/repair/apply: `false`',
      'manual deploy: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(harness).toContain("retryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER'");
    expect(harness).toContain("mode: 'retry_with_fixed_adapter'");
    expect(adapter).toContain("select('customer_id,store_id')");
    expect(adapter).not.toContain("select('customer_id,id,store_id')");
  });

  it('records dry-run readiness with the retained partial customer baseline', () => {
    [
      'Result before execute: `DRY_RUN_READY_NO_WRITE`',
      '- exact-one-store: `PASS`',
      '- dry-run production write: `false`',
      '| `customers` | `1` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
      'pre-count of `1` matches the retained PR #130 partial synthetic customer baseline',
      '`retry_with_fixed_adapter`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the single execute attempt and forbids retry or cleanup', () => {
    [
      'Execute attempt count: `1`',
      'Second retry attempt: `false`',
      'Harness terminal status: `EXECUTED_WITH_APPROVAL`',
      'The command exit code was `0`',
      'No second retry was attempted.',
      'No cleanup/delete was executed.',
      'cleanup requires separate owner approval',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents actual target deltas and the partial contact result', () => {
    [
      '| `customers` | `1` | `1` | `+0` | `+0 or +1, max 1` | `PASS_RETAINED_PARTIAL_CUSTOMER` |',
      '| `customer_contacts` | `0` | `0` | `+0` | `upsert max 1` | `PARTIAL_NOT_CREATED` |',
      '| `inquiries` | `0` | `1` | `+1` | `insert max 1` | `PASS_CREATED` |',
      '| `customer_timeline_events` | `0` | `1` | `+1` | `insert max 1~2` | `PASS_CREATED` |',
      '| `customer_contacts` by fixed synthetic contact id | `0` |',
      '| `customer_contacts` by synthetic customer id | `0` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps non-target table effects at zero', () => {
    [
      '| `stores` | `insert 0` | `0` |',
      '| `store_members` | `insert 0` | `0` |',
      '| `store_subscriptions` | `insert 0` | `0` |',
      '| `store_public_pages` | `insert 0` | `0` |',
      '| `leads` | `insert 0` | `0` |',
      '| `visitor_sessions` | `insert 0` | `0` |',
      '| `feedback records` | `insert 0` | `0` |',
      '| `payments/webhooks` | `insert 0` | `0` |',
      '| non-target tables | insert/update/delete `0` | `0` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents sanitized read-back without raw PII or row samples', () => {
    [
      '- customer card sanitized result: `retained_partial_customer_count_1`',
      '- customer contact sanitized result: `not_created`',
      '- inquiry inbox redacted result: `created_marker_present`',
      '- inquiry inbox synthetic-email-domain check: `example.invalid`',
      '- timeline non-PII result: `created`',
      '- raw customer row sample output: `false`',
      '- raw phone/email/name output: `false`',
      '- raw full store id output: `false`',
      'real customer name/phone/email: forbidden',
      'raw customer/contact/inquiry/timeline row samples: forbidden',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(doc).not.toContain("from('customers').select('*')");
    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(doc).not.toMatch(/\b010[-\s]?\d{3,4}[-\s]?\d{4}\b/);
  });

  it('records the partial decision and required next gates', () => {
    [
      'Status: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`',
      'Canary result decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`',
      'The end-to-end synthetic canary did not fully pass',
      'do not run a second retry without a fresh owner approval and a new plan',
      'investigate why the server adapter did not create the synthetic contact row',
      'broader PRO/VIP customer-memory rollout remains blocked',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the actual side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      aligned_retry_gate_used: true,
      canary_decision: 'SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED',
      cleanup_executed: false,
      customer_contacts_upsert_count: 0,
      customer_row_sample_output: false,
      customer_timeline_events_insert_count: 1,
      customers_upsert_delta: 0,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_env_verified: true,
      external_notification_sent: false,
      fixed_adapter_used: true,
      inquiries_insert_count: 1,
      live_customer_memory_gate_enabled_persistently: false,
      manual_deploy: false,
      migration_apply: false,
      non_target_table_changed: false,
      owner_approval: true,
      payment_or_webhook_touched: false,
      pr_106_merged: false,
      production_db_write: true,
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
