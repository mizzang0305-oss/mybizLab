import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const doc = readFileSync(
  resolve(root, 'docs/customer-memory-contact-only-retry-after-gate-fix-result.md'),
  'utf8',
);
const harness = readFileSync(resolve(root, 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

const approval =
  'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX';
const marker = 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618';

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact-only retry after gate fix result', () => {
  it('records the owner approval, exact execute env, slug, marker, and pass decision', () => {
    [
      'Status: `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS`',
      approval,
      'MYBIZ_CANARY_EXECUTE=true',
      'MYBIZ_CANARY_STORE_SLUG=mybizlab-test',
      `MYBIZ_CANARY_MARKER=${marker}`,
      'gate: `contact_only_non_pii_after_dependency_fix`',
      'Decision: `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS`',
      'Contact proof: `PROVEN`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records dry-run and pre-count evidence before the single execute attempt', () => {
    [
      'status: `DRY_RUN_READY_NO_WRITE`',
      'approval mode: `contact_only_non_pii_dry_run`',
      'execute requested: `false`',
      '| `customers` | `1` | `1` |',
      '| `customer_contacts` | `0` | `0` |',
      '| `inquiries` | `1` | `1` |',
      '| `customer_timeline_events` | `1` | `1` |',
      'Exact-one-store check for slug `mybizlab-test`: `PASS`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the bounded contact-only DB effect and preserves existing proofs', () => {
    [
      'status: `EXECUTED_WITH_APPROVAL`',
      'execute attempt count: `1`',
      '| `customers` | `+0` | `+0` | `PASS` |',
      '| `customer_contacts` | `+1 max` | `+1` | `PASS` |',
      '| `inquiries` | `+0` | `+0` | `PASS` |',
      '| `customer_timeline_events` | `+0`, or `+1 max` only if required by adapter design | `+0` | `PASS` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
      'existing inquiry proof retained: `true`',
      'existing timeline proof retained: `true`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records sanitized read-back without raw rows, raw full store id, or PII', () => {
    [
      'status: `SANITIZED_READ_BACK_PASS`',
      'marker-scoped contact count: `1`',
      'contact type policy: `other`',
      'contact normalized marker match: `true`',
      'contact raw value policy: `marker_only_or_null`',
      'contact/customer linkage matches synthetic customer: `true`',
      'contact store scope matches target store: `true`',
      'wrong-store contact count: `0`',
      'raw PII output: `false`',
      'raw row sample output: `false`',
      'raw full store_id output: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(doc).not.toMatch(/\b01[016789]-?\d{3,4}-?\d{4}\b/);
    expect(doc).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(doc).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  });

  it('keeps contact policy non-PII and forbids placeholder phone/email as real contacts', () => {
    [
      '`contact_type=other`',
      'normalized value: marker only',
      'raw value: marker only or null',
      'real customer name: `false`',
      'real phone: `false`',
      'real email: `false`',
      'placeholder phone saved as real contact: `false`',
      'placeholder email saved as real contact: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).toContain("contactType: 'other'");
    expect(harness).toContain('rawValue: APPROVED_TARGET.marker');
    expect(harness).toContain('normalizedValue: APPROVED_TARGET.marker');
  });

  it('keeps forbidden paths out of scope and confirms the next rollout gate', () => {
    [
      'cleanup/delete: `false`',
      'second retry attempt: `false`',
      'public API write route call: `false`',
      'external notification/SMS/email/webhook call: `false`',
      'payment or webhook touched: `false`',
      'Cleanup/delete and live customer-memory gate enablement remain separate approvals.',
      'PRO_VIP_CUSTOMER_MEMORY_ROLLOUT_READINESS_REVIEW',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('matches the side-effects matrix for the successful contact-only proof', () => {
    expect(extractSideEffects()).toEqual({
      cleanup_executed: false,
      contact_only_mode: true,
      customer_contacts_delta: 1,
      customer_row_sample_output: false,
      customer_timeline_events_delta: 0,
      customers_delta: 0,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_env_verified: true,
      external_notification_sent: false,
      inquiries_delta: 0,
      manual_deploy: false,
      migration_apply: false,
      non_pii_contact_policy_used: true,
      non_target_table_changed: false,
      owner_approval: true,
      payment_or_webhook_touched: false,
      placeholder_email_saved_as_real_contact: false,
      placeholder_phone_saved_as_real_contact: false,
      pr_106_merged: false,
      pr_125_merged: false,
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
      synthetic_marker: marker,
      target_row_cap_exceeded: false,
      test_store_slug: 'mybizlab-test',
    });
  });
});
