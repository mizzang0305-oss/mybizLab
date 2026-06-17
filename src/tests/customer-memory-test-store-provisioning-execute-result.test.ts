import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-test-store-provisioning-execute-result.md'), 'utf8');

function readSideEffects() {
  const match = doc.match(/## side_effects\s+```json\s+([\s\S]*?)\s+```/);

  expect(match, 'side_effects JSON block').not.toBeNull();

  return JSON.parse(match?.[1] ?? '{}') as Record<string, boolean | number>;
}

describe('customer-memory test-store provisioning execute result', () => {
  it('records the owner approval gate and approved dedicated test-store target', () => {
    for (const expectedText of [
      'Required owner approval string: `APPROVE_DEDICATED_TEST_STORE_PROVISIONING`',
      'Approval gate result: `PASS`',
      'display alias: `마이비즈랩 테스트 스토어`',
      'slug: `mybizlab-test`',
      'store_id policy: `DB-generated/schema-compliant only`',
      'direct literal store_id such as `마이비즈랩` is forbidden',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('ties the result to the merged PR #126 baseline and current Draft PR #125 state', () => {
    for (const expectedText of [
      'PR #125 state: `OPEN_DRAFT`',
      'PR #126 state: `MERGED`',
      'PR #126 decision: `DEDICATED_TEST_STORE_APPROVAL_REQUIRED`',
      'PR #126 merge commit: `916644be2040b2435e56ad6a40dab1c1f3fca15e`',
      'production deploy/read-only smoke before execution: `PASS`',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('documents the preflight controls without SELECT star or raw evidence output', () => {
    for (const expectedText of [
      'production `public.stores` only',
      'explicit allowlist projection only',
      'projection: `store_id,slug,plan,created_at`',
      '`SELECT *`: forbidden',
      'store identifier column: `store_id`',
      'customer/contact/inquiry/timeline/lead/payment row sample output: `forbidden`',
      'raw PII output: `forbidden`',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('records pre-count, post-count, slug conflict, and exact-one-store confirmation', () => {
    for (const expectedText of [
      'current production stores count before provisioning: `6`',
      'slug conflict count before provisioning for approved slug: `0`',
      '| `stores` total pre-count | `6` | `6` |',
      '| `stores` total post-count | `7` | `7` |',
      '| approved slug count after | `1` | `1` |',
      '| exact-one-store confirmation | `true` | `true` |',
      'store_id masked | `960b40b6...a0ed`',
      'store_id hash | `5f84c707e917f845`',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('records approved versus actual DB effects and keeps customer-memory rows at zero', () => {
    for (const expectedText of [
      '`stores insert max 1` | `stores insert 1`',
      '`store_members insert max 1 only if required and safely resolvable` | `store_members insert 0`',
      '`store_subscriptions insert max 1 only if required` | `store_subscriptions insert 0`',
      '`store_public_pages insert max 1 only if required` | `store_public_pages insert 0`',
      '`customers insert 0` | `customers insert 0`',
      '`customer_contacts insert 0` | `customer_contacts insert 0`',
      '`inquiries insert 0` | `inquiries insert 0`',
      '`customer_timeline_events insert 0` | `customer_timeline_events insert 0`',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('keeps customer-memory canary, live gate, cleanup, and broad mutation blocked', () => {
    for (const expectedText of [
      'Canary status: `BLOCKED`',
      'No live customer-memory gate was enabled',
      'no test inquiry was saved',
      'no synthetic customer-memory rows were created',
      'cleanup/delete requires separate owner approval',
      'no broad update/delete',
      'no migration, repair, apply, db push, SQL replay, RLS/GRANT/REVOKE',
    ]) {
      expect(doc).toContain(expectedText);
    }
  });

  it('includes the required side-effect matrix', () => {
    expect(readSideEffects()).toEqual({
      owner_approval: true,
      production_db_write: true,
      test_store_created: true,
      stores_insert_count: 1,
      store_members_insert_count: 0,
      store_subscriptions_insert_count: 0,
      store_public_pages_insert_count: 0,
      customer_row_created: false,
      customer_contact_row_created: false,
      inquiry_row_created: false,
      timeline_row_created: false,
      live_customer_memory_gate_enabled: false,
      api_write_call: false,
      test_inquiry_created: false,
      raw_pii_output: false,
      customer_row_sample_output: false,
      rls_or_grant_executed: false,
      migration_apply: false,
      db_push: false,
      sql_replay: false,
      env_auth_payment_webhook_changed: false,
      manual_deploy: false,
      sales_excel_import_touched: false,
      pr_106_merged: false,
      canary_write_blocked: true,
    });
  });
});
