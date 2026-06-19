import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const report = readFileSync(resolve(process.cwd(), 'docs/customer-memory-overnight-automation-report.md'), 'utf8');

function extractSideEffects() {
  const match = report.match(/## J\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory overnight automation report', () => {
  it('records the required report sections and status', () => {
    [
      '## A. Overnight Status',
      '## B. Branch / PR List',
      '## C. Customer-Memory Proof Status',
      '## D. Contact-Only Retry Result',
      '## E. DB Side Effects',
      '## F. Validation Result',
      '## G. Blockers',
      '## H. Next Approval Required',
      '## I. Business Impact',
      '## J. side_effects JSON',
      '## K. What Was Not Done',
      'OVERNIGHT_BLOCKED_SAFE_HARNESS_READY',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('documents the PRs created and merged during the overnight run', () => {
    [
      '| #136 | `codex/customer-memory-contact-only-retry-non-pii` | `MERGED`',
      '| #137 | `codex/customer-memory-contact-only-harness-mode` | `MERGED`',
      '00d9ebd098667de037d804a9a11f54459e7a5182',
      'e7916b06b2fd31d5fa287faaca3e4d5441451970',
      'dpl_AgX1YSfZQeD49qhhbQQccTAZd8Ls',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('keeps the contact-only proof status and next approval explicit', () => {
    [
      'BLOCKED_NO_CONTACT_ONLY_HARNESS_MODE',
      'CONTACT_ONLY_HARNESS_MODE_READY_FOR_REVIEW',
      'contact_only_mode=true',
      'future contact-only execute calls `saveCustomerContact` only',
      '`customers +0`, `customer_contacts +0/+1 max`, `inquiries +0`, `customer_timeline_events +0`',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      'The non-PII contact path is not yet proven',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('records only zero overnight DB deltas and read-only production smoke', () => {
    [
      '| `customers` | `0` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
      '| `/` | `200` |',
      '| `/pricing` | `200` |',
      '| `/admin/leads` | `200` |',
      '| `/dashboard/customers` | `200` |',
      '| `/dashboard/ai-reports` | `200` |',
      'production DB write: `false`',
      'execute attempt count: `0`',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('keeps business impact and production launch gaps documented', () => {
    [
      'User problem solved',
      'Revenue path supported',
      'Data that can be collected next',
      'Remaining before production launch',
      'Customer memory proof supports CRM reliability',
      'One non-PII marker-only synthetic contact proof',
      'Run the freshly approved contact-only retry once.',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('keeps prohibited side effects false and avoids private evidence patterns', () => {
    expect(report).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(report).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
    expect(report).not.toMatch(/\b(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/);
    expect(report).not.toContain('SELECT *');

    expect(extractSideEffects()).toMatchObject({
      additional_production_db_write: false,
      cleanup_executed: false,
      contact_only_mode_added: true,
      contact_only_mode_merged: true,
      contact_only_retry_executed: false,
      contact_path_proven: false,
      customer_contacts_delta: 0,
      customer_row_sample_output: false,
      customers_delta: 0,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_attempt_count: 0,
      external_notification_sent: false,
      inquiries_delta: 0,
      manual_deploy: false,
      migration_apply: false,
      next_required_approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_full_store_id_output: false,
      raw_pii_output: false,
      rls_or_grant_executed: false,
      second_retry_attempt: false,
      sql_replay: false,
      timeline_path_proven_prior: true,
    });
  });
});
