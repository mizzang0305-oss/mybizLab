import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-contact-only-harness-mode.md'), 'utf8');
const harness = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact-only harness mode', () => {
  it('adds the approved contact-only gate while preserving existing approval gates', () => {
    [
      "contactRetryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT'",
      'approval: APPROVED_TARGET.contactRetryApproval',
      "mode: 'contact_only_non_pii'",
      'contactOnly: true',
      'approval: APPROVED_TARGET.approval',
      'approval: APPROVED_TARGET.retryApproval',
      "mode: 'initial_canary'",
      "mode: 'retry_with_fixed_adapter'",
    ].forEach((expected) => expect(harness).toContain(expected));
  });

  it('supports contact-only dry-run without production writes', () => {
    [
      "mode: gate?.contactOnly ? 'contact_only_non_pii_dry_run' : 'dry_run'",
      'contact_only_mode: Boolean(gate.contactOnly)',
      "status: 'DRY_RUN_READY_NO_WRITE'",
      'production_db_write: false',
      'dry-run still performs no production write',
      'Verified dry-run evidence on this branch',
      'approval mode: `contact_only_non_pii_dry_run`',
      'contact-only mode: `true`',
      'execute requested: `false`',
      'production DB write: `false`',
    ].forEach((expected) => expect(doc + harness).toContain(expected));
  });

  it('restricts contact-only execute to saveCustomerContact only', () => {
    [
      'if (options.contactOnly)',
      'await repository.saveCustomerContact(payload.contact);',
      'does not call `saveCustomer`',
      'does not call `saveInquiry`',
      'does not call `appendTimelineEvent`',
    ].forEach((expected) => expect(doc + harness).toContain(expected));

    const contactOnlyBlock = harness.match(/if \(options\.contactOnly\) \{[\s\S]*?return;\n\s{2}\}/)?.[0] || '';
    expect(contactOnlyBlock).toContain('saveCustomerContact');
    expect(contactOnlyBlock).not.toContain('saveCustomer(');
    expect(contactOnlyBlock).not.toContain('saveInquiry');
    expect(contactOnlyBlock).not.toContain('appendTimelineEvent');
  });

  it('requires the retained PR #134/#136 baseline before contact-only execute', () => {
    [
      'assertContactOnlyPreCounts',
      'CONTACT_ONLY_CUSTOMER_BASELINE_REQUIRED',
      'CONTACT_ONLY_CONTACT_PRECOUNT_REQUIRED',
      'CONTACT_ONLY_INQUIRY_BASELINE_REQUIRED',
      'CONTACT_ONLY_TIMELINE_BASELINE_REQUIRED',
      '| `customers` | `1` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `1` |',
      '| `customer_timeline_events` | `1` |',
      'pre-counts: `customers 1`, `customer_contacts 0`, `inquiries 1`, `customer_timeline_events 1`',
      'non-target counts: `stores 1`, `store_members 0`, `store_subscriptions 0`, `store_public_pages 0`',
    ].forEach((expected) => expect(doc + harness).toContain(expected));
  });

  it('keeps the non-PII contact policy and future row caps explicit', () => {
    [
      'assertContactOnlyRowEffects',
      'CONTACT_ONLY_ROW_EFFECT_EXCEEDED',
      '`customers` delta must be `+0`',
      '`customer_contacts` delta must be `+0` or `+1`, max `1`',
      '`inquiries` delta must be `+0`',
      '`customer_timeline_events` delta must be `+0`',
      '`contact_type=other`',
      '`normalized_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      '`raw_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      '| `customers` | `+0` |',
      '| `customer_contacts` | `+1 max` |',
      '| `inquiries` | `+0` |',
      '| `customer_timeline_events` | `+0` |',
      'real customer name: forbidden',
      'real phone: forbidden',
      'real email: forbidden',
    ].forEach((expected) => expect(doc + harness).toContain(expected));
  });

  it('continues to forbid public API writes, SELECT star, cleanup, schema changes, and manual deploy', () => {
    [
      'does not execute the future write',
      'No production DB write',
      'public API write route',
      'schema change',
      'manual deploy',
      'Cleanup/delete remains a separate approval',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('matches the no-execute side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      canary_retry_executed: false,
      cleanup_executed: false,
      contact_only_dry_run_supported: true,
      contact_only_execute_performed: false,
      contact_only_mode_added: true,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_requires_owner_approval: true,
      inquiry_row_created: false,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      non_pii_contact_policy_used: true,
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
      schema_changed: false,
      server_adapter_path_only: true,
      sql_replay: false,
      timeline_row_created: false,
    });
  });
});
