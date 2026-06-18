import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-synthetic-canary-execute-with-harness-result.md'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('synthetic customer-memory canary execute-with-harness result', () => {
  it('records the owner approval, execute env, marker, and dedicated test store slug', () => {
    [
      'Required owner approval string: `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`',
      'Approval gate result: `PASS`',
      'Required execute env result: `PASS`',
      '`MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`',
      '`MYBIZ_CANARY_EXECUTE=true`',
      '`MYBIZ_CANARY_STORE_SLUG=mybizlab-test`',
      '`MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'dedicated test store slug: `mybizlab-test`',
      'synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('uses the merged safe harness and server adapter path only', () => {
    [
      'safe merged harness: `scripts/customer-memory/synthetic-canary-harness.mjs`',
      'server customer-memory adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      'public API write route call: `false`',
      'ad hoc harness creation: `false`',
      'SQL replay: `false`',
      'migration/db push/repair/apply: `false`',
      'manual deploy: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records dry-run readiness and pre-counts without write side effects', () => {
    [
      'Result before execute: `DRY_RUN_READY_NO_WRITE`',
      '- exact-one-store: `PASS`',
      '- dry-run production write: `false`',
      '| `customers` | `0` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
      '| `stores` for approved slug | `1` |',
      '| `store_members` for approved store | `0` |',
      '| `store_subscriptions` for approved store | `0` |',
      '| `store_public_pages` for approved store | `0` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the single blocked execute attempt and adapter mismatch', () => {
    [
      'Execute attempt count: `1`',
      'Second execute attempt: `false`',
      'Harness terminal status: `BLOCKED`',
      'Failed to load customer ids for customer memory store isolation: column customers.id does not exist',
      '`saveCustomer` completed its `customers` upsert.',
      '`saveCustomerContact` then called the store-isolation helper.',
      'read-only post-counts establish the actual production DB effect as `customers +1`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents actual row deltas and row caps for target tables', () => {
    [
      '| `customers` | `0` | `1` | `+1` | `upsert max 1` | `PASS_WITH_PARTIAL_WRITE` |',
      '| `customer_contacts` | `0` | `0` | `+0` | `upsert max 1` | `PASS_NOT_CREATED` |',
      '| `inquiries` | `0` | `0` | `+0` | `insert max 1` | `PASS_NOT_CREATED` |',
      '| `customer_timeline_events` | `0` | `0` | `+0` | `insert max 1~2` | `PASS_NOT_CREATED` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps non-target tables and wrong-store exposure at zero', () => {
    [
      '| `customers` | `0` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
      '| `stores` | unchanged at `7` |',
      '| `store_members` | unchanged at `7` |',
      '| `store_subscriptions` | unchanged at `1` |',
      '| `store_public_pages` | unchanged at `6` |',
      '| `lead_capture_requests` | unchanged at `0` |',
      '| `visitor_sessions` | unchanged at `79` |',
      '| `payment_events` | unchanged at `7` |',
      '| `payments/webhooks` | `payments/webhooks insert 0` | `0` |',
      '| non-target tables | insert/update/delete `0` | `0` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents synthetic-only payload constraints and raw PII prohibitions', () => {
    [
      'customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`',
      'phone: `OMITTED_NOT_REAL_NUMBER`',
      'email: `OMITTED_NOT_REAL_EMAIL`',
      'real customer identifier: forbidden',
      'real customer name/phone/email: forbidden',
      'raw PII output: forbidden',
      'raw customer/contact/inquiry/timeline row samples: forbidden',
      'raw full `store_id`: not output',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records sanitized read-back and separate cleanup approval posture', () => {
    [
      '- customer card sanitized result: `created_partial_customer_count_1`',
      '- inquiry inbox redacted result: `not_created`',
      '- timeline non-PII result: `not_created`',
      '- wrong-store/non-test-store exposure: `0`',
      '- raw customer row sample output: `false`',
      '- raw phone/email/name output: `false`',
      '- cleanup in this PR: `false`',
      '- cleanup/delete execution: forbidden',
      '- cleanup requires separate owner approval and a separate evidence record',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the blocked decision and next gate', () => {
    [
      'Canary result decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT`',
      'the end-to-end synthetic canary did not pass',
      'fix the adapter store-isolation projection in a separate PR',
      'broader PRO/VIP customer-memory rollout remains blocked',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the actual side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      canary_decision: 'SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT',
      cleanup_executed: false,
      customer_contacts_upsert_count: 0,
      customer_row_sample_output: false,
      customer_timeline_events_insert_count: 0,
      customers_upsert_count: 1,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_env_verified: true,
      external_notification_sent: false,
      feedback_records_insert_count: 0,
      inquiries_insert_count: 0,
      leads_insert_count: 0,
      live_customer_memory_gate_enabled_persistently: false,
      manual_deploy: false,
      migration_apply: false,
      non_target_table_changed: false,
      owner_approval: true,
      payment_or_webhook_touched: false,
      payments_webhooks_insert_count: 0,
      pr_106_merged: false,
      production_db_write: true,
      public_api_write_call: false,
      raw_full_store_id_output: false,
      raw_pii_output: false,
      real_customer_name_used: false,
      real_email_used: false,
      real_phone_used: false,
      rls_or_grant_executed: false,
      safe_harness_used: true,
      sales_excel_import_touched: false,
      second_execute_attempt: false,
      sql_replay: false,
      store_members_insert_count: 0,
      store_public_pages_insert_count: 0,
      store_subscriptions_insert_count: 0,
      stores_insert_count: 0,
      synthetic_marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      target_row_cap_exceeded: false,
      test_inquiry_created_with_real_data: false,
      test_store_slug: 'mybizlab-test',
      visitor_sessions_insert_count: 0,
    });
  });
});
