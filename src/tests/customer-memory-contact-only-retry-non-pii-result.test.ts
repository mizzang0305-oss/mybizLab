import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-contact-only-retry-non-pii-result.md'), 'utf8');
const harness = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');
const adapter = readFileSync(resolve(process.cwd(), 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory non-PII contact-only retry result', () => {
  it('records the approval, env, slug, marker, and blocked decision', () => {
    [
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      'MYBIZ_CANARY_EXECUTE=true',
      'MYBIZ_CANARY_STORE_SLUG=mybizlab-test',
      'MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      'Status: `BLOCKED_NO_CONTACT_ONLY_HARNESS_MODE`',
      'contact-only execute attempt count: `0`',
      'production DB write: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('captures marker-scoped pre-counts and zero write deltas without row samples', () => {
    [
      '| `customers` | `1` | `1` |',
      '| `customer_contacts` | `0` | `0` |',
      '| `inquiries` | `1` | `1` |',
      '| `customer_timeline_events` | `1` | `1` |',
      '| `customers` | `+0` | `+0` |',
      '| `customer_contacts` | `+1 max` | `+0` |',
      '| `inquiries` | `+0` | `+0` |',
      'customer/contact/inquiry/timeline row sample output: `false`',
      'raw PII output: `false`',
      'raw full `store_id`: not output',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('confirms contact policy and adapter store_id alignment while blocking real contact data', () => {
    [
      '`contact_type=other`',
      '`normalized_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      '`raw_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618` or `null` only',
      'real customer name: forbidden',
      'real phone: forbidden',
      'real email: forbidden',
      'placeholder phone saved as real contact: forbidden',
      'placeholder email saved as real contact: forbidden',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(adapter).toContain('store_id: contact.store_id');
    expect(harness).toContain("contactType: 'other'");
    expect(harness).toContain('SYNTHETIC_CONTACT_POLICY');
  });

  it('documents that the merged harness lacks a contact-only execute mode', () => {
    [
      'exists only as `SYNTHETIC_CONTACT_POLICY.nextApproval`',
      '`APPROVAL_GATES` does not include a contact-only gate',
      'cannot declare `contact_only_mode=true`',
      '`executeViaServerAdapter` calls `saveCustomer`, `saveCustomerContact`, `saveInquiry`, and `appendTimelineEvent`',
      'there is no approved path that calls only `saveCustomerContact`',
      'CONTACT_ONLY_HARNESS_FIX_REQUIRED',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toContain('contactOnly');
    expect(harness).not.toContain('contact_only_mode');
  });

  it('keeps SELECT star, cleanup, second retry, public API writes, and external effects forbidden', () => {
    [
      '`SELECT *`: `false`',
      'public API write route call: `false`',
      'cleanup/delete: `false`',
      'second retry: `false`',
      'external_notification_sent',
      'payment_or_webhook_touched',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('matches the no-write side effects matrix for the blocked contact-only result', () => {
    expect(extractSideEffects()).toEqual({
      cleanup_executed: false,
      contact_only_mode: false,
      customer_contacts_delta: 0,
      customer_row_sample_output: false,
      customer_timeline_events_delta: 0,
      customers_delta: 0,
      db_push: false,
      decision: 'BLOCKED_NO_CONTACT_ONLY_HARNESS_MODE',
      env_auth_payment_webhook_changed: false,
      execute_env_verified: true,
      external_notification_sent: false,
      inquiries_delta: 0,
      manual_deploy: false,
      migration_apply: false,
      next_step: 'CONTACT_ONLY_HARNESS_FIX_REQUIRED',
      non_pii_contact_policy_used: true,
      non_target_table_changed: false,
      owner_approval: true,
      payment_or_webhook_touched: false,
      placeholder_email_saved_as_real_contact: false,
      placeholder_phone_saved_as_real_contact: false,
      pr_106_merged: false,
      pr_125_merged: false,
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
      test_store_slug: 'mybizlab-test',
    });
  });
});
