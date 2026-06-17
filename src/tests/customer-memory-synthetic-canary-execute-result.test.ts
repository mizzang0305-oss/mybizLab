import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-synthetic-canary-execute-result.md'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('synthetic customer-memory canary execute result', () => {
  it('records the owner approval, target marker, and dedicated test store slug', () => {
    expect(doc).toContain('Required owner approval string: `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`');
    expect(doc).toContain('Approval gate result: `PASS`');
    expect(doc).toContain('dedicated test store slug: `mybizlab-test`');
    expect(doc).toContain('synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`');
    expect(doc).toContain('selected store id: masked `960b40b6...a0ed`; hash `5f84c707e917f845`');
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('uses the server adapter path and blocks execution without an existing safe local harness', () => {
    expect(doc).toContain('Selected planned write path: server customer-memory adapter path');
    expect(doc).toContain('`src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`');
    expect(doc).toContain('Execution result: `BLOCKED_NO_APPROVED_EXECUTION_HARNESS`');
    expect(doc).toContain('No existing safe local execution harness was found');
    expect(doc).toContain('Creating a new ad hoc production write harness during this run would not satisfy the approval brief.');
  });

  it('locks the approved row caps and records that no production write happened', () => {
    [
      '`customers upsert max 1`',
      '`customer_contacts upsert max 1`',
      '`inquiries insert max 1`',
      '`customer_timeline_events insert max 1~2`',
      '`stores insert 0`',
      '`store_members insert 0`',
      '`store_subscriptions insert 0`',
      '`store_public_pages insert 0`',
      '| `customers` | `customers upsert max 1` | `0` |',
      '| `customer_contacts` | `customer_contacts upsert max 1` | `0` |',
      '| `inquiries` | `inquiries insert max 1` | `0` |',
      '| `customer_timeline_events` | `customer_timeline_events insert max 1~2` | `0` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents synthetic-only payload constraints and raw PII prohibitions', () => {
    [
      'customer display name: `MYBIZ_CANARY_SYNTHETIC_CUSTOMER`',
      'phone: `OMITTED_NOT_REAL_NUMBER`',
      'email: `OMITTED_NOT_REAL_EMAIL`',
      'real customer identifier: forbidden',
      'no real customer name/phone/email',
      'raw PII forbidden',
      'raw customer/contact/inquiry/timeline row samples: not output',
      '`SELECT *` is forbidden and was not used.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps public API writes, external side effects, and cleanup forbidden', () => {
    [
      'No public API write route was called.',
      'Public API write route invocation is forbidden.',
      'Persistent gate enablement is forbidden.',
      'cleanup requires separate owner approval',
      'cleanup/delete execution: forbidden',
      'payment_or_webhook_touched',
      'external_notification_sent',
      'manual_deploy',
      'sales_excel_import_touched',
      'pr_106_merged',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records preflight counts without row samples', () => {
    [
      '| approved slug exact-one-store | `PASS` |',
      '| marker-scoped `customers` count | `0` |',
      '| marker-scoped `customer_contacts` count | `0` |',
      '| marker-scoped `inquiries` count | `0` |',
      '| marker-scoped `customer_timeline_events` count | `0` |',
      '- customer card sanitized result: `not_created`',
      '- inquiry inbox redacted result: `not_created`',
      '- timeline non-PII result: `not_created`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the blocked side-effects matrix', () => {
    expect(extractSideEffects()).toMatchObject({
      blocked_no_approved_execution_harness: true,
      cleanup_executed: false,
      customer_contacts_upsert_count: 0,
      customer_row_sample_output: false,
      customers_upsert_count: 0,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      external_notification_sent: false,
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
      sales_excel_import_touched: false,
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
