import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const doc = readFileSync(
  resolve(root, 'docs/customer-memory-contact-only-retry-after-dependency-fix-result.md'),
  'utf8',
);
const harness = readFileSync(resolve(root, 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact-only retry after dependency fix result', () => {
  it('records the requested approval/env and blocked gate decision', () => {
    [
      'Status: `BLOCKED_CONTACT_ONLY_RETRY_APPROVAL_GATE_NOT_ALIGNED`',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
      'MYBIZ_CANARY_EXECUTE=true',
      'MYBIZ_CANARY_STORE_SLUG=mybizlab-test',
      'MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      'result: `MYBIZ_CANARY_APPROVAL_REQUIRED`',
      'Contact proof remains: `NOT_PROVEN`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('confirms the merged harness does not support the after-dependency-fix contact-only approval phrase', () => {
    expect(harness).toContain(
      "contactRetryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT'",
    );
    expect(harness).not.toContain(
      "contactRetryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX'",
    );
  });

  it('probes only the approval gate and blocks before any DB-facing execution path', () => {
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        [
          "import { readExecuteGate } from './scripts/customer-memory/synthetic-canary-harness.mjs';",
          'try {',
          'readExecuteGate(process.env);',
          "console.log(JSON.stringify({ status: 'GATE_PASS' }));",
          '} catch (error) {',
          'console.log(JSON.stringify({',
          "status: 'BLOCKED_CONTACT_ONLY_RETRY_APPROVAL_GATE_NOT_ALIGNED',",
          'gate_error: String(error?.message || error),',
          'execute_attempt_count: 0,',
          'production_db_write: false,',
          'public_api_write_call: false,',
          '}));',
          '}',
        ].join(' '),
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          MYBIZ_CANARY_APPROVAL:
            'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
          MYBIZ_CANARY_EXECUTE: 'true',
          MYBIZ_CANARY_STORE_SLUG: 'mybizlab-test',
          MYBIZ_CANARY_MARKER: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
        },
        timeout: 15_000,
      },
    );

    expect(probe.status).toBe(0);
    expect(probe.stderr).toBe('');
    expect(JSON.parse(probe.stdout)).toEqual({
      status: 'BLOCKED_CONTACT_ONLY_RETRY_APPROVAL_GATE_NOT_ALIGNED',
      gate_error: 'MYBIZ_CANARY_APPROVAL_REQUIRED',
      execute_attempt_count: 0,
      production_db_write: false,
      public_api_write_call: false,
    });
  });

  it('documents that dry-run, counts, execute, and read-back were stopped by the gate', () => {
    [
      '| contact-only dry-run | `not_executed` |',
      '| pre-count read | `not_executed` |',
      '| contact-only execute | `not_attempted` |',
      '| execute attempt count | `0` |',
      '| post-count read | `not_executed` |',
      '| sanitized read-back | `not_executed` |',
      '| `customers` | `1` | `false` |',
      '| `customer_contacts` | `0` | `false` |',
      '| `inquiries` | `1` | `false` |',
      '| `customer_timeline_events` | `1` | `false` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps all write, cleanup, retry, public API, schema, env, and protected PR effects out of scope', () => {
    [
      '| `customers` | `+0` | `+0` |',
      '| `customer_contacts` | `+1 max` | `+0` |',
      '| `inquiries` | `+0` | `+0` |',
      'Target row cap exceeded: `false`',
      'Non-target table changed: `false`',
      'second retry: `false`',
      'cleanup/delete: `false`',
      'full customer-memory canary retry: `false`',
      'public API write route call: `false`',
      'ad hoc harness creation: `false`',
      'raw PII output: `false`',
      'raw row sample output: `false`',
      'RLS/GRANT/REVOKE: `false`',
      'migration/db push/repair/apply: `false`',
      'SQL replay: `false`',
      'env/auth/payment/webhook change: `false`',
      'sales Excel import touched: `false`',
      'manual deploy: `false`',
      'PR #106 merge: `false`',
      'PR #125 merge: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('matches the blocked after-dependency-fix side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      ad_hoc_harness_created: false,
      approval_env_gate_result: 'BLOCKED_CONTACT_ONLY_RETRY_APPROVAL_GATE_NOT_ALIGNED',
      approval_phrase_received: true,
      cleanup_executed: false,
      contact_only_dry_run_executed: false,
      contact_only_execute_attempted: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      execute_attempt_count: 0,
      external_notification_sent: false,
      full_customer_memory_canary_retry: false,
      gate_error: 'MYBIZ_CANARY_APPROVAL_REQUIRED',
      inquiry_row_created: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: 'ALIGN_CONTACT_ONLY_AFTER_DEPENDENCY_FIX_APPROVAL_GATE',
      non_target_table_changed: false,
      pr_106_merged: false,
      pr_125_merged: false,
      pre_count_read_executed: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      real_customer_name_used: false,
      real_email_used: false,
      real_phone_used: false,
      required_after_dependency_fix_approval_supported: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      second_retry_executed: false,
      sql_replay: false,
      timeline_row_created: false,
    });
  });
});
