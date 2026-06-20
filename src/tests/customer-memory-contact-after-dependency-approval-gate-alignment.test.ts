import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const doc = readFileSync(
  resolve(root, 'docs/customer-memory-contact-after-dependency-approval-gate-alignment.md'),
  'utf8',
);
const harness = readFileSync(resolve(root, 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');

const afterDependencyApproval =
  'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX';
const approvedSlug = 'mybizlab-test';
const syntheticMarker = 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618';

function readGate(env: Record<string, string>) {
  const probe = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      [
        "import { readExecuteGate } from './scripts/customer-memory/synthetic-canary-harness.mjs';",
        'try {',
        'const gate = readExecuteGate(process.env);',
        "console.log(JSON.stringify({ ok: true, gate, production_db_write: false, public_api_write_call: false }));",
        '} catch (error) {',
        'console.log(JSON.stringify({',
        'ok: false,',
        'error: String(error?.message || error),',
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
        MYBIZ_CANARY_APPROVAL: '',
        MYBIZ_CANARY_EXECUTE: '',
        MYBIZ_CANARY_MARKER: '',
        MYBIZ_CANARY_STORE_SLUG: '',
        ...env,
      },
      timeout: 15_000,
    },
  );

  expect(probe.status).toBe(0);
  expect(probe.stderr).toBe('');
  return JSON.parse(probe.stdout) as Record<string, unknown>;
}

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('customer-memory contact after-dependency approval gate alignment', () => {
  it('adds the after-dependency-fix contact approval phrase and preserves existing approval phrases', () => {
    [
      "approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY'",
      "retryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER'",
      "contactRetryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT'",
      'contactAfterDependencyFixApproval:',
      afterDependencyApproval,
      'contactOnlyNonPiiRetryAfterDependencyFix',
      "mode: 'contact_only_non_pii_after_dependency_fix'",
    ].forEach((expected) => expect(harness).toContain(expected));

    [
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT',
      afterDependencyApproval,
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('requires exact approval, execute flag, slug, and marker before execute can pass', () => {
    expect(
      readGate({
        MYBIZ_CANARY_APPROVAL: afterDependencyApproval,
        MYBIZ_CANARY_EXECUTE: 'true',
        MYBIZ_CANARY_MARKER: syntheticMarker,
        MYBIZ_CANARY_STORE_SLUG: approvedSlug,
      }),
    ).toEqual({
      gate: {
        allowPartialCustomerBaseline: true,
        contactOnly: true,
        execute: true,
        mode: 'contact_only_non_pii_after_dependency_fix',
      },
      ok: true,
      production_db_write: false,
      public_api_write_call: false,
    });
  });

  it('blocks execute=true when approval, slug, or marker is missing or mismatched', () => {
    expect(readGate({ MYBIZ_CANARY_EXECUTE: 'true' })).toMatchObject({
      error: 'MYBIZ_CANARY_APPROVAL_REQUIRED',
      ok: false,
      production_db_write: false,
      public_api_write_call: false,
    });

    expect(
      readGate({
        MYBIZ_CANARY_APPROVAL: afterDependencyApproval,
        MYBIZ_CANARY_EXECUTE: 'true',
        MYBIZ_CANARY_MARKER: syntheticMarker,
        MYBIZ_CANARY_STORE_SLUG: 'wrong-store',
      }),
    ).toMatchObject({
      error: 'MYBIZ_CANARY_STORE_SLUG_MISMATCH',
      ok: false,
    });

    expect(
      readGate({
        MYBIZ_CANARY_APPROVAL: afterDependencyApproval,
        MYBIZ_CANARY_EXECUTE: 'true',
        MYBIZ_CANARY_MARKER: 'WRONG_MARKER',
        MYBIZ_CANARY_STORE_SLUG: approvedSlug,
      }),
    ).toMatchObject({
      error: 'MYBIZ_CANARY_MARKER_MISMATCH',
      ok: false,
    });
  }, 20_000);

  it('preserves dry-run default and contact-only dry-run mode without production writes', () => {
    expect(
      readGate({
        MYBIZ_CANARY_APPROVAL: afterDependencyApproval,
        MYBIZ_CANARY_MARKER: syntheticMarker,
        MYBIZ_CANARY_STORE_SLUG: approvedSlug,
      }),
    ).toEqual({
      gate: {
        allowPartialCustomerBaseline: true,
        contactOnly: true,
        execute: false,
        mode: 'contact_only_non_pii_dry_run',
      },
      ok: true,
      production_db_write: false,
      public_api_write_call: false,
    });

    [
      'Dry-run default is preserved',
      'dry-run returns `DRY_RUN_READY_NO_WRITE`',
      'production DB write remains `false`',
      'Verified dry-run evidence on this branch',
      'approval mode: `contact_only_non_pii_dry_run`',
      'contact-only mode: `true`',
      'execute requested: `false`',
      'pre-counts: `customers 1`, `customer_contacts 0`, `inquiries 1`, `customer_timeline_events 1`',
      'contact-only retry executed: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps contact-only execution scoped away from customer, inquiry, timeline, public API, and raw output paths', () => {
    const contactOnlyBlock = harness.match(/if \(options\.contactOnly\) \{[\s\S]*?return;\n\s{2}\}/)?.[0] || '';

    expect(contactOnlyBlock).toContain('saveCustomerContact');
    expect(contactOnlyBlock).not.toContain('saveCustomer(');
    expect(contactOnlyBlock).not.toContain('saveInquiry');
    expect(contactOnlyBlock).not.toContain('appendTimelineEvent');

    expect(harness).not.toContain("select('*')");
    expect(harness).not.toContain('select("*")');
    expect(harness).not.toMatch(/fetch\(['"`]\/api\//);

    [
      'public `/api/*` write routes are not used',
      'raw PII and raw row samples remain forbidden',
      'customer/contact/inquiry/timeline row creation: `false`',
      'PR #106 merge: `false`',
      'PR #125 merge: `false`',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the no-write side-effects matrix for the alignment PR', () => {
    expect(extractSideEffects()).toEqual({
      ad_hoc_harness_created: false,
      after_dependency_fix_approval_gate_aligned: true,
      approved_store_slug: 'mybizlab-test',
      cleanup_executed: false,
      contact_only_retry_executed: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      dry_run_default: true,
      env_auth_payment_webhook_changed: false,
      execute_requires_marker: true,
      execute_requires_owner_approval: true,
      execute_requires_slug: true,
      external_notification_sent: false,
      initial_approval_gates_preserved: true,
      inquiry_row_created: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_approval: afterDependencyApproval,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      sql_replay: false,
      synthetic_marker: syntheticMarker,
      timeline_row_created: false,
    });
  });
});
