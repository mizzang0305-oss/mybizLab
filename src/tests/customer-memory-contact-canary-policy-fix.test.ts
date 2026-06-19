import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-contact-canary-policy-fix.md'), 'utf8');
const adapter = readFileSync(resolve(process.cwd(), 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'), 'utf8');
const harness = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact canary policy fix', () => {
  it('records the PR #134 contact-not-created baseline without raw row evidence', () => {
    [
      'PR #134 decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`',
      '| `customers` | `+0` |',
      '| `customer_contacts` | `+0` |',
      '| `inquiries` | `+1` |',
      '| `customer_timeline_events` | `+1` |',
      'contact path proven: `false`',
      'no data rows',
      'no customer/contact/inquiry/timeline row samples',
      'no raw PII',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents live contact schema metadata and keeps schema operations out of scope', () => {
    [
      'Read-only metadata source: Supabase PostgREST OpenAPI schema.',
      '| `customer_id` | foreign key to `customers.customer_id` |',
      '| `store_id` | present |',
      '| `contact_type` | present |',
      '| `normalized_value` | present |',
      '| `raw_value` | present |',
      'No canary retry, cleanup/delete, production DB write',
      'schema change',
      'migration',
      'db push',
      'SQL replay',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('persists store_id in the production contact payload without adding wildcard reads or logs', () => {
    expect(adapter).toContain('store_id: contact.store_id');
    expect(adapter).toContain("client.from('customer_contacts').upsert(payload, { onConflict: 'id' })");
    expect(adapter).toContain('CUSTOMER_CONTACT_STORE_SCOPE_MISMATCH');
    expect(adapter).toContain(
      ".select('id,store_id,customer_id,contact_type,raw_value,normalized_value,is_primary,is_verified,created_at')",
    );
    expect(adapter).not.toContain("from('customer_contacts').select('*')");
    expect(adapter).not.toMatch(/\bconsole\.(log|warn|error)\b/);
  });

  it('switches the synthetic contact canary to a non-PII other contact policy', () => {
    expect(harness).toContain('SYNTHETIC_CONTACT_POLICY');
    expect(harness).toContain("contactType: 'other'");
    expect(harness).toContain("rawValue: APPROVED_TARGET.marker");
    expect(harness).toContain("normalizedValue: APPROVED_TARGET.marker");
    expect(harness).toContain("type: SYNTHETIC_CONTACT_POLICY.contactType");
    expect(harness).toContain("value: SYNTHETIC_CONTACT_POLICY.rawValue");
    expect(harness).toContain("normalized_value: SYNTHETIC_CONTACT_POLICY.normalizedValue");
    expect(harness).toContain('NON_PII_SYNTHETIC_CONTACT_POLICY_REQUIRED');
    expect(harness).toContain('SYNTHETIC_CONTACT_REAL_CHANNEL_FORBIDDEN');
    expect(harness).toContain('SYNTHETIC_CONTACT_VALUE_MUST_BE_MARKER_ONLY');
    expect(harness).not.toContain('normalized_value: syntheticEmail');
    expect(harness).not.toContain("type: 'email',");
    expect(harness).not.toContain('value: syntheticEmail');
  });

  it('requires fresh owner approval before any contact retry', () => {
    [
      'Retry status in this PR: `BLOCKED_PENDING_FRESH_OWNER_APPROVAL`',
      'This PR does not run the harness and does not retry the canary.',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
    ].forEach((expected) => expect(doc + harness).toContain(expected));
  });

  it('does not save omitted placeholder phone or email as real contact channels', () => {
    [
      '`OMITTED_NOT_REAL_NUMBER` is not saved as a phone contact.',
      '`OMITTED_NOT_REAL_EMAIL` is not saved as an email contact.',
      'The contact policy rejects `phone`, `email`, `@`, and phone-like contact values',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toMatch(/type:\s*['"]phone['"]/);
    expect(harness).not.toMatch(/type:\s*['"]email['"]/);
  });

  it('matches the required side-effects matrix for investigation-only fix work', () => {
    expect(extractSideEffects()).toEqual({
      canary_retry_executed: false,
      cleanup_executed: false,
      contact_policy_fixed: true,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      inquiry_row_created: false,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      non_pii_contact_policy: true,
      placeholder_email_saved_as_real_contact: false,
      placeholder_phone_saved_as_real_contact: false,
      pr_106_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      real_email_used: false,
      real_phone_used: false,
      retry_requires_fresh_owner_approval: true,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      schema_changed: false,
      sql_replay: false,
      timeline_row_created: false,
    });
  });
});
