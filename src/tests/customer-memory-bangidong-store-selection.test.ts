import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-bangidong-store-selection.md');

describe('customer-memory Bangidong store selection packet', () => {
  it('records the PR #123 merged baseline and the owner-selected alias', () => {
    expect(doc).toContain('Status: `DRAFT_PR_SELECTION_PACKET_ONLY`');
    expect(doc).toContain('Branch: `codex/customer-memory-bangidong-store-selection`');
    expect(doc).toContain('PR #123 state: `MERGED`');
    expect(doc).toContain('main HEAD: `b824ef50844f8fbe6d1751ab30a5d104a360cb16`');
    expect(doc).toContain('Owner-selected alias: `방이동`');
  });

  it('documents read-only production lookup policy and forbids unsafe query output', () => {
    for (const policyText of [
      'Production lookup mode: `READ_ONLY_SANITIZED_LOOKUP`',
      '`SELECT *`: forbidden',
      'explicit column allowlist only',
      'no customer/contact/inquiry/timeline row samples',
      'raw customer/PII output: forbidden',
      'actual customer row sample output: forbidden',
    ]) {
      expect(doc).toContain(policyText);
    }
  });

  it('records the candidate count and all possible candidate decisions', () => {
    for (const decisionText of [
      'candidate count: `0`',
      'Decision: `OWNER_STORE_NOT_FOUND`',
      '`TEST_STORE_SELECTED_BANGIDONG`',
      '`OWNER_STORE_NOT_FOUND`',
      '`OWNER_STORE_AMBIGUOUS`',
      '`OWNER_RECONFIRM_TEST_STORE_REQUIRED`',
      'exactly one store candidate is required before any canary write approval',
    ]) {
      expect(doc).toContain(decisionText);
    }
  });

  it('blocks the approval packet when the selected alias is unresolved', () => {
    for (const packetText of [
      'Canary owner approval packet status: `BLOCKED_OWNER_STORE_NOT_FOUND`',
      'selected alias: `방이동`',
      'resolved store_id: `not resolved`',
      'synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`',
      'synthetic-only payload required',
      'server customer-memory adapter path',
    ]) {
      expect(doc).toContain(packetText);
    }
  });

  it('preserves row caps and live-write bans for any future canary', () => {
    for (const effectText of [
      '`customers` upsert max 1',
      '`customer_contacts` upsert max 1',
      '`inquiries` insert max 1',
      '`customer_timeline_events` insert max 1-2',
      'production DB write in this PR: `forbidden`',
      'live customer memory write enablement in this PR: `forbidden`',
      'live lead write enablement in this PR: `forbidden`',
      'API write call in this PR: `forbidden`',
      'test inquiry save in this PR: `forbidden`',
      'new store creation in this PR: `forbidden`',
    ]) {
      expect(doc).toContain(effectText);
    }
  });

  it('keeps PR publication safe as Draft-only without Ready conversion or merge', () => {
    for (const prText of [
      'Draft PR only',
      'Ready conversion: `forbidden`',
      'merge: `forbidden`',
      'manual deploy: `forbidden`',
      'PR #106 merge: `forbidden`',
      'protected untracked cleanup: `forbidden`',
    ]) {
      expect(doc).toContain(prText);
    }
  });

  it('includes the required false side-effects matrix', () => {
    for (const sideEffect of [
      '"production_db_write": false',
      '"production_schema_changed": false',
      '"migration_apply": false',
      '"db_push": false',
      '"migration_repair": false',
      '"sql_replay": false',
      '"rls_or_grant_executed": false',
      '"live_customer_memory_write": false',
      '"live_customer_memory_gate_enabled": false',
      '"live_lead_write": false',
      '"live_lead_gate_enabled": false',
      '"test_inquiry_created": false',
      '"new_store_created": false',
      '"env_auth_payment_webhook_changed": false',
      '"raw_pii_output": false',
      '"external_notification_sent": false',
      '"sales_excel_import_touched": false',
      '"manual_deploy": false',
      '"pr_106_merged": false',
      '"owner_selected_store_alias": "방이동"',
      '"test_store_selection_packet_created": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }
  });
});
