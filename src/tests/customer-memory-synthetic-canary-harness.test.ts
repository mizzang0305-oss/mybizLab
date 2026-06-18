import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-synthetic-canary-harness.md'), 'utf8');
const script = readFileSync(resolve(process.cwd(), 'scripts/customer-memory/synthetic-canary-harness.mjs'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('safe local synthetic customer-memory canary harness', () => {
  it('adds the requested dry-run harness entrypoint without an execute shortcut', () => {
    expect(packageJson.scripts['customer-memory:canary:dry-run']).toBe(
      'node scripts/customer-memory/synthetic-canary-harness.mjs',
    );
    expect(packageJson.scripts['customer-memory:canary:execute']).toBeUndefined();
    expect(script).toContain("status: 'DRY_RUN_READY_NO_WRITE'");
    expect(script).toContain('production_db_write: false');
  });

  it('requires explicit owner approval before execute mode can pass', () => {
    expect(script).toContain("MYBIZ_CANARY_APPROVAL_REQUIRED");
    expect(script).toContain("MYBIZ_CANARY_APPROVAL");
    expect(script).toContain("MYBIZ_CANARY_EXECUTE");
    expect(script).toContain("MYBIZ_CANARY_STORE_SLUG");
    expect(script).toContain("MYBIZ_CANARY_MARKER");
    expect(doc).toContain('MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY');
    expect(doc).toContain('MYBIZ_CANARY_EXECUTE=true');
  });

  it('locks the approved slug, marker, exact-one-store requirement, and PR #128 baseline', () => {
    [
      'BLOCKED_NO_APPROVED_EXECUTION_HARNESS',
      'fa55a6390dcd0d1e4b0f6f78db827e3a749538b6',
      'mybizlab-test',
      'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      'exactly one store',
      'PR #125 must remain OPEN Draft',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(script).toContain("slug: 'mybizlab-test'");
    expect(script).toContain("marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618'");
    expect(script).toContain('EXACT_ONE_STORE_REQUIRED');
  });

  it('uses only the server adapter path and forbids public API write routes', () => {
    expect(doc).toContain('server adapter path only: `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts`');
    expect(doc).toContain('does not use `/api/*` public write routes');
    expect(script).toContain("SERVER_ADAPTER_PATH = 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'");
    expect(script).toContain('createProductionCustomerMemorySchemaAdapter');
    expect(script).toContain('public_api_write_call: false');
    expect(script).not.toMatch(/fetch\(['"`]\/api\//);
  });

  it('forbids SELECT star and uses explicit allowlisted projections', () => {
    expect(doc).toContain('`SELECT *` is forbidden and is not used by the harness.');
    expect(script).not.toContain("select('*')");
    expect(script).not.toContain('select("*")');
    [
      "select('store_id,slug,plan,created_at'",
      "select('customer_id'",
      "select('id'",
    ].forEach((expected) => expect(script).toContain(expected));
  });

  it('documents and enforces row caps for the four customer-memory target tables', () => {
    [
      '`customers` | `customers upsert max 1`',
      '`customer_contacts` | `customer_contacts upsert max 1`',
      '`inquiries` | `inquiries insert max 1`',
      '`customer_timeline_events` | `customer_timeline_events insert max 1~2`',
      'TARGET_ROW_CAP_EXCEEDED',
    ].forEach((expected) => expect(doc + script).toContain(expected));
    expect(script).toContain('TARGET_ROW_CAPS');
    expect(script).toContain('customer_timeline_events: 2');
  });

  it('keeps real customer PII, raw row samples, and cleanup out of scope', () => {
    [
      'real customer name: forbidden',
      'real customer phone: forbidden',
      'real customer email: forbidden',
      'raw PII output: forbidden',
      'customer/contact/inquiry/timeline row samples: forbidden',
      'Cleanup requires a separate approval',
      'This PR creates no canary rows',
    ].forEach((expected) => expect(doc).toContain(expected));
    expect(script).toContain('SYNTHETIC_CUSTOMER_EMAIL_REQUIRED');
    expect(script).toContain('REAL_CUSTOMER_PHONE_FORBIDDEN');
    expect(script).not.toMatch(/\b010[-\s]?\d{3,4}[-\s]?\d{4}\b/);
  });

  it('states that this PR does not execute production writes or enable live gates', () => {
    [
      'does not execute the canary',
      'does not write to production',
      'does not enable a live customer-memory gate',
      'does not call a public API write route',
      '| `customers` | `0` |',
      '| `customer_contacts` | `0` |',
      '| `inquiries` | `0` |',
      '| `customer_timeline_events` | `0` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('matches the requested side-effects false matrix', () => {
    expect(extractSideEffects()).toEqual({
      approved_store_slug: 'mybizlab-test',
      canary_executed: false,
      cleanup_executed: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      dry_run_default: true,
      env_auth_payment_webhook_changed: false,
      execute_requires_owner_approval: true,
      harness_added: true,
      inquiry_row_created: false,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      pr_106_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      sql_replay: false,
      synthetic_marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
      test_inquiry_created: false,
      timeline_row_created: false,
    });
  });
});
