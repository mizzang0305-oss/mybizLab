import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const doc = readFileSync(resolve(root, 'docs/customer-memory-harness-dependency-scan-fix.md'), 'utf8');
const report = readFileSync(resolve(root, 'docs/customer-memory-contact-only-dependency-blocker-report.md'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

function extractSideEffects(source: string) {
  const match = source.match(/## (?:J\. )?side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory harness dependency-scan fix', () => {
  it('records the PR #139 dependency-scan blocker baseline', () => {
    [
      'BLOCKED_EXECUTE_HARNESS_DEPENDENCY_SCAN_FAILED',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      'execute attempt count recorded by PR #139: `1`',
      'PR #139 production DB write: `false`',
      'customers 0',
      'customer_contacts 0',
      'inquiries 0',
      'customer_timeline_events 0',
      'PR #139 cleanup/delete: `false`',
      'PR #139 second retry: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('uses a script-only Vite server adapter loader with dependency discovery disabled', () => {
    [
      'SERVER_ADAPTER_LOADER_POLICY',
      "configFile: false",
      "envFile: false",
      "optimizeDepsNoDiscovery: true",
      'function createServerAdapterLoaderConfig()',
      'configFile: false',
      'envFile: false',
      'entries: []',
      'include: []',
      'noDiscovery: true',
      'hmr: false',
      'middlewareMode: true',
      'root: process.cwd()',
      'export async function loadServerAdapter()',
    ].forEach((expected) => expect(harness).toContain(expected));
  });

  it('imports the server adapter through the fixed loader without executing writes', () => {
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        [
          "import { loadServerAdapter, SERVER_ADAPTER_LOADER_POLICY } from './scripts/customer-memory/synthetic-canary-harness.mjs';",
          'const adapterFactory = await loadServerAdapter();',
          'console.log(JSON.stringify({',
          'adapterFactoryType: typeof adapterFactory,',
          'configFile: SERVER_ADAPTER_LOADER_POLICY.configFile,',
          'envFile: SERVER_ADAPTER_LOADER_POLICY.envFile,',
          'optimizeDepsNoDiscovery: SERVER_ADAPTER_LOADER_POLICY.optimizeDepsNoDiscovery,',
          'production_db_write: false,',
          '}));',
        ].join(' '),
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          MYBIZ_CANARY_EXECUTE: '',
        },
        timeout: 15_000,
      },
    );

    expect(probe.status).toBe(0);
    expect(probe.stderr).toBe('');
    expect(JSON.parse(probe.stdout)).toEqual({
      adapterFactoryType: 'function',
      configFile: false,
      envFile: false,
      optimizeDepsNoDiscovery: true,
      production_db_write: false,
    });
  }, 20_000);

  it('preserves approval, slug, marker, contact-only, public API, and cleanup gates', () => {
    [
      'owner approval required: `true`',
      'execute flag required: `true`',
      'approved slug required: `mybizlab-test`',
      'approved marker required: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`',
      'contact-only mode preserved: `true`',
      'public API write route forbidden: `true`',
      '`SELECT *` forbidden: `true`',
      'raw PII output forbidden: `true`',
      'cleanup/delete requires separate approval: `true`',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(harness).toContain('readExecuteGate');
    expect(harness).toContain('assertExecutePreCounts');
    expect(harness).toContain('assertContactOnlyRowEffects');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);
    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
  });

  it('documents no-write dry-run verification and retained marker counts', () => {
    [
      'Adapter import-only probe:',
      'adapter factory type: `function`',
      'production DB write: `false`',
      'Dry-run verification:',
      'status: `DRY_RUN_READY_NO_WRITE`',
      'execute requested: `false`',
      '| `customers` | `1` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `1` |',
      '| `customer_timeline_events` | `1` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps retry, cleanup, schema, env, payment, sales, and protected PR effects out of scope', () => {
    [
      'contact-only retry rerun: `false`',
      'second retry: `false`',
      'cleanup/delete: `false`',
      'production DB write: `false`',
      'customer/contact/inquiry/timeline row creation: `false`',
      'ad hoc production write harness creation: `false`',
      'real customer name/phone/email/Kakao ID/address use: `false`',
      'raw PII or raw row sample output: `false`',
      'full raw store id output: `false`',
      'RLS/GRANT/REVOKE: `false`',
      'migration/db push/repair/apply: `false`',
      'SQL replay: `false`',
      'env/auth/payment/webhook change: `false`',
      'payment/webhook path touched: `false`',
      'sales Excel import touched: `false`',
      'manual deploy: `false`',
      'PR #106 merge: `false`',
      'PR #125 merge: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('adds the required final blocker report with the same next approval', () => {
    [
      '# Customer-Memory Contact-Only Dependency Blocker Report',
      'Status: `DEPENDENCY_SCAN_BLOCKER_RECORDED_AND_FIX_PREPARED`',
      'PR #139: `docs(customer-memory): record blocked contact-only retry result` - merged',
      'PR #140: `fix(customer-memory): make canary harness adapter loading node-safe` - prepared from branch `codex/customer-memory-harness-dependency-scan-fix`',
      'The dependency-scan blocker is fixed in code, but the contact-only proof is not yet complete.',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
    ].forEach((expected) => expect(report).toContain(expected));
  });

  it('matches the dependency-scan fix side-effects matrix', () => {
    expect(extractSideEffects(doc)).toEqual({
      ad_hoc_production_write_harness_created: false,
      approval_gate_preserved: true,
      cleanup_executed: false,
      contact_only_mode_preserved: true,
      contact_only_retry_executed: false,
      customer_row_sample_output: false,
      db_push: false,
      dependency_scan_blocker_fixed: true,
      env_auth_payment_webhook_changed: false,
      execute_attempt_count: 0,
      execute_flag_required: true,
      execute_requires_owner_approval: true,
      external_notification_sent: false,
      manual_deploy: false,
      marker_gate_preserved: true,
      migration_apply: false,
      next_required_approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
      payment_or_webhook_touched: false,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_full_store_id_output: false,
      raw_pii_output: false,
      real_customer_name_used: false,
      real_email_used: false,
      real_phone_used: false,
      rls_or_grant_executed: false,
      safe_harness_loader_preserved: true,
      sales_excel_import_touched: false,
      schema_changed: false,
      slug_gate_preserved: true,
      sql_replay: false,
    });
  });

  it('matches the final report side-effects matrix', () => {
    expect(extractSideEffects(report)).toEqual({
      ad_hoc_production_write_harness_created: false,
      approval_gate_preserved: true,
      cleanup_executed: false,
      contact_only_retry_rerun: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      dependency_scan_blocker_fixed: true,
      env_auth_payment_webhook_changed: false,
      execute_attempt_count_after_fix: 0,
      external_notification_sent: false,
      inquiry_row_created: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX',
      payment_or_webhook_touched: false,
      phase_1_blocked_result_pr_merged: true,
      phase_2_dependency_scan_fix_prepared: true,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_full_store_id_output: false,
      raw_pii_output: false,
      rls_or_grant_executed: false,
      safe_harness_loader_preserved: true,
      sales_excel_import_touched: false,
      second_retry_executed: false,
      sql_replay: false,
      timeline_row_created: false,
    });
  });
});
