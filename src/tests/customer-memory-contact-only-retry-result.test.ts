import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-contact-only-retry-result.md'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact-only retry dependency-scan blocked result', () => {
  it('records the owner approval, single execute attempt, and dependency-scan decision', () => {
    [
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      'Status: `BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED`',
      'Final decision:',
      'BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED',
      'contact-only retry: `true`',
      'execute attempt count: `1`',
      'execute completed: `false`',
      'blocker class: `sanitized_vite_dependency_scan_failed`',
      'server adapter load path: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`',
      'safe harness path: `scripts/customer-memory/synthetic-canary-harness.mjs`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps dry-run readiness and marker-scoped counts sanitized', () => {
    [
      'Dry-run result: `DRY_RUN_READY_NO_WRITE`',
      'selected store id: masked/hash only',
      'payload: `synthetic_only_redacted`',
      'raw PII output: `false`',
      'raw row sample output: `false`',
      '`SELECT *`: `false`',
      '| `customers` | retained prior synthetic customer count: `1` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | prior proof retained: `1` |',
      '| `customer_timeline_events` | prior proof retained: `1` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records zero write deltas after the blocked attempt', () => {
    [
      '| `customers` | `1` | `1` | `0` |',
      '| `customer_contacts` | `0` | `0` | `0` |',
      '| `inquiries` | `1` | `1` | `0` |',
      '| `customer_timeline_events` | `1` | `1` | `0` |',
      '| `customers` | `+0` | `+0` |',
      '| `customer_contacts` | `+1 max` | `+0` |',
      '| `inquiries` | `+0` | `+0` |',
      'All new write deltas: `0`',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps prohibited side effects false and protected untracked untouched', () => {
    [
      'production DB write: `false`',
      'public API write route call: `false`',
      'ad hoc production write harness created: `false`',
      'second retry executed: `false`',
      'cleanup/delete executed: `false`',
      'live customer-memory gate enabled: `false`',
      'real customer name used: `false`',
      'real phone used: `false`',
      'real email used: `false`',
      'raw contact value output: `false`',
      'raw full store id output: `false`',
      'customer/contact/inquiry/timeline row sample output: `false`',
      'RLS/GRANT/REVOKE executed: `false`',
      'migration/db push/repair/apply: `false`',
      'SQL replay: `false`',
      'env/auth/payment/webhook changed: `false`',
      'external notification/SMS/email/webhook sent: `false`',
      'sales Excel import touched: `false`',
      'manual deploy: `false`',
      'PR #106 merged: `false`',
      'PR #125 merged: `false`',
      'protected untracked `.claude/worktrees/`, `.playwright-mcp/`, and `AGENTS.md`: untouched',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the next safe no-write investigation step', () => {
    [
      'Next required step: `INVESTIGATE_HARNESS_DEPENDENCY_SCAN_BLOCKER`',
      'no-write harness/server-adapter loading investigation and fix',
      'future contact-only retry still requires a separate owner approval',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the dependency-scan blocked side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      ad_hoc_production_write_harness_created: false,
      approval_phrase_received: true,
      cleanup_executed: false,
      contact_only_execute_attempted: true,
      contact_only_retry_completed: false,
      customer_contact_row_created: false,
      customer_contacts_delta: 0,
      customer_row_created: false,
      customer_row_sample_output: false,
      customer_timeline_events_delta: 0,
      customers_delta: 0,
      db_push: false,
      decision: 'BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED',
      dependency_scan_blocker: true,
      dry_run_ready_no_write: true,
      env_auth_payment_webhook_changed: false,
      execute_attempt_count: 1,
      external_notification_sent: false,
      inquiry_row_created: false,
      inquiries_delta: 0,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: 'INVESTIGATE_HARNESS_DEPENDENCY_SCAN_BLOCKER',
      non_target_table_changed: false,
      payment_or_webhook_touched: false,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      protected_untracked_touched: false,
      public_api_write_call: false,
      raw_contact_value_output: false,
      raw_full_store_id_output: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      real_address_used: false,
      real_customer_name_used: false,
      real_email_used: false,
      real_kakao_id_used: false,
      real_phone_used: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      second_retry_executed: false,
      sql_replay: false,
      target_row_cap_exceeded: false,
      timeline_row_created: false,
    });
  });
});
