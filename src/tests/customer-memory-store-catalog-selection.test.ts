import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-store-catalog-selection.md');

describe('customer-memory store catalog selection packet', () => {
  it('records the merged baselines and the not-found decision from PR #124', () => {
    for (const baselineText of [
      'Status: `DRAFT_PR_SELECTION_PACKET_ONLY`',
      'Branch: `codex/customer-memory-store-catalog-selection`',
      'PR #123 state: `MERGED`',
      'PR #124 state: `MERGED`',
      'PR #124 decision: `OWNER_STORE_NOT_FOUND`',
      'main HEAD after PR #124: `8ed0ce0fa87f620080db461bd577522791e7a76c`',
    ]) {
      expect(doc).toContain(baselineText);
    }
  });

  it('documents a read-only explicit allowlist production stores lookup', () => {
    for (const lookupText of [
      'Production catalog lookup mode: `READ_ONLY_SANITIZED_STORES_CATALOG`',
      'table: `public.stores`',
      '`SELECT *`: forbidden',
      'explicit column allowlist only',
      'allowlist columns used: `store_id`, `slug`, `name`, `brand_config`, `created_at`, `plan`',
      'customer/contact/inquiry/timeline row samples: forbidden',
      'raw PII output: forbidden',
      'API write call: forbidden',
    ]) {
      expect(doc).toContain(lookupText);
    }
  });

  it('records the sanitized catalog count and all six candidate numbers', () => {
    expect(doc).toContain('total stores count: `6`');
    expect(doc).toContain('catalog row count: `6`');

    for (const candidateNo of [1, 2, 3, 4, 5, 6]) {
      expect(doc).toContain(`| ${candidateNo} |`);
    }
  });

  it('requires exactly one owner-selected candidate before canary execution', () => {
    for (const decisionText of [
      'Candidate decision: `OWNER_SELECT_EXACTLY_ONE_CANDIDATE`',
      'owner selection required',
      'exact-one-store requirement',
      'canary write status: `BLOCKED_UNTIL_OWNER_SELECTS_ONE_CANDIDATE`',
      'canary execution PR: `not this PR`',
    ]) {
      expect(doc).toContain(decisionText);
    }
  });

  it('preserves the synthetic-only payload and expected row caps for a future packet', () => {
    for (const packetText of [
      'synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`',
      'synthetic-only payload required',
      'write path: server customer-memory adapter path',
      '`customers` upsert max 1',
      '`customer_contacts` upsert max 1',
      '`inquiries` insert max 1',
      '`customer_timeline_events` insert max 1-2',
      'cleanup requires separate approval',
    ]) {
      expect(doc).toContain(packetText);
    }
  });

  it('lists stop conditions that keep the canary blocked', () => {
    for (const stopCondition of [
      'owner does not select one candidate',
      'candidate count mismatch',
      'raw PII risk',
      'ambiguous selected store',
      'store type/test/internal status unclear',
      'Vercel protection blocks read-back',
    ]) {
      expect(doc).toContain(stopCondition);
    }
  });

  it('includes the required false side-effects matrix', () => {
    for (const sideEffect of [
      '"production_db_write": false',
      '"live_customer_memory_gate_enabled": false',
      '"api_write_call": false',
      '"test_inquiry_created": false',
      '"new_store_created": false',
      '"raw_pii_output": false',
      '"customer_contact_inquiry_timeline_samples": false',
      '"rls_or_grant_executed": false',
      '"migration_apply": false',
      '"db_push": false',
      '"migration_repair": false',
      '"sql_replay": false',
      '"env_auth_payment_webhook_changed": false',
      '"external_notification_sent": false',
      '"sales_excel_import_touched": false',
      '"manual_deploy": false',
      '"pr_106_merged": false',
      '"store_catalog_selection_packet_created": true',
      '"canary_write_blocked": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }
  });
});
