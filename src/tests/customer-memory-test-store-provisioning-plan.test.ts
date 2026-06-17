import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

function readSideEffects(doc: string) {
  const match = doc.match(/## side_effects\s+```json\s+([\s\S]*?)\s+```/);

  expect(match, 'side_effects JSON block').not.toBeNull();

  return JSON.parse(match?.[1] ?? '{}') as Record<string, boolean>;
}

const doc = readWorkspaceFile('docs/customer-memory-test-store-provisioning-plan.md');

describe('customer-memory test-store provisioning approval packet', () => {
  it('records the merged baselines and the unresolved PR #125 selection state', () => {
    for (const baselineText of [
      'Status: `DRAFT_PR_APPROVAL_PACKET_ONLY`',
      'Branch: `codex/customer-memory-test-store-provisioning-plan`',
      'PR #123 state: `MERGED`',
      'PR #124 decision: `OWNER_STORE_NOT_FOUND`',
      'PR #125 decision: `OWNER_SELECT_EXACTLY_ONE_CANDIDATE`',
      'owner selected candidate no: `none`',
      'canary write remains `BLOCKED`',
    ]) {
      expect(doc).toContain(baselineText);
    }
  });

  it('documents the owner decision and proposed dedicated test store identity', () => {
    for (const storeText of [
      'Provisioning decision: `DEDICATED_TEST_STORE_APPROVAL_REQUIRED`',
      'create a dedicated test store instead of using one of the existing six production stores',
      'display alias: `마이비즈랩 테스트 스토어`',
      'slug candidate: `mybizlab-test`',
      'store_id: `DB-generated or schema-compliant identifier only`',
      'do not directly set `store_id` to `마이비즈랩`',
      'provisioning is `approval-gated`',
    ]) {
      expect(doc).toContain(storeText);
    }
  });

  it('keeps the live schema check read-only and scoped to public.stores', () => {
    for (const lookupText of [
      'production `public.stores` read-only only',
      'explicit allowlist only',
      '`SELECT *`: forbidden',
      'store identifier column: `store_id`',
      'current total stores count: `6`',
      'slug candidate conflict count: `0`',
      'customer/contact/inquiry/timeline/lead/payment table access: `forbidden`',
      'customer/contact/inquiry/timeline/lead/payment row sample output: `forbidden`',
      'raw PII output: `forbidden`',
    ]) {
      expect(doc).toContain(lookupText);
    }
  });

  it('defines future provisioning row caps without creating customer-memory rows', () => {
    for (const effectText of [
      '`stores` insert max 1',
      '`store_members` insert max 1 if required',
      '`store_subscriptions` insert max 1 if required',
      '`store_public_pages` insert max 1 if required',
      '`customers` insert 0',
      '`customer_contacts` insert 0',
      '`inquiries` insert 0',
      '`customer_timeline_events` insert 0',
      'new store creation execution in this PR: `forbidden`',
      'production DB write in this PR: `forbidden`',
      'API write call in this PR: `forbidden`',
      'test inquiry save in this PR: `forbidden`',
    ]) {
      expect(doc).toContain(effectText);
    }
  });

  it('requires exact-one-store confirmation and separate canary approval after provisioning', () => {
    for (const nextText of [
      'post-provisioning exact-one-store lookup is required',
      'sanitized store summary only',
      'no raw PII',
      'no customer rows',
      'selected test store confirmation packet',
      'separate customer-memory synthetic canary approval',
      'synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`',
      'canary write remains `BLOCKED` until a later approval packet',
    ]) {
      expect(doc).toContain(nextText);
    }
  });

  it('documents stop conditions and cleanup as separate approval only', () => {
    for (const stopText of [
      'slug conflict',
      'store count delta exceeds approved cap',
      'required membership/subscription relation unclear',
      'raw PII risk',
      'RLS/permission uncertainty',
      'any customer/inquiry/timeline row changes',
      'deleting the test store requires separate approval',
      'cleanup execution in this PR: `forbidden`',
    ]) {
      expect(doc).toContain(stopText);
    }
  });

  it('includes the required false side-effects matrix', () => {
    const sideEffects = readSideEffects(doc);

    expect(sideEffects).toEqual({
      production_db_write: false,
      test_store_created: false,
      live_customer_memory_gate_enabled: false,
      api_write_call: false,
      test_inquiry_created: false,
      customer_row_created: false,
      inquiry_row_created: false,
      timeline_row_created: false,
      raw_pii_output_in_committed_files: false,
      customer_row_sample_output: false,
      rls_or_grant_executed: false,
      migration_apply: false,
      db_push: false,
      sql_replay: false,
      env_auth_payment_webhook_changed: false,
      manual_deploy: false,
      ready_transition: false,
      merge: false,
      canary_write_blocked: true,
      test_store_provisioning_packet_created: true,
    });
  });
});
