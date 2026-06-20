import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const docPath = 'docs/pro-vip-customer-memory-pilot-execution-plan.md';
const absoluteDocPath = resolve(process.cwd(), docPath);
const doc = readFileSync(absoluteDocPath, 'utf8');

const decision = 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_DRAFT';
const consumedApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED';
const nextApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED';

function extractSideEffects() {
  const match = doc.match(/## Q\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('PRO/VIP customer-memory pilot execution plan packet', () => {
  it('creates the required document with the execution-plan draft decision', () => {
    expect(existsSync(absoluteDocPath)).toBe(true);
    expect(doc).toContain(`Status: \`${decision}\``);
    expect(doc).toContain('This docs/tests-only PR creates the PRO/VIP customer-memory pilot execution plan only.');
  });

  it('records the consumed approval phrase and next approval phrase with narrow authorization', () => {
    [
      consumedApprovalPhrase,
      'This phrase authorizes creation of the pilot execution plan PR only.',
      nextApprovalPhrase,
      'this next phrase authorizes creation of the dry-run/real-data-test plan only',
      'It does not authorize:',
      '- production DB write.',
      '- live customer-memory gate enablement.',
      '- dry-run execution.',
      '- pilot execute.',
      '- cleanup.',
      '- billing exposure.',
      '- automation/reporting exposure.',
      '- external notification.',
      '- bulk customer import.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('states this PR does not authorize any execution, write, gate, cleanup, billing, or notification path', () => {
    [
      '| this PR scope | `EXECUTION_PLAN_ONLY` | creates documentation and tests only |',
      '| live customer-memory gate | `NOT_ENABLED` | remains separately gated |',
      '| dry-run execution | `NOT_EXECUTED` | not authorized by this PR |',
      '| pilot execution | `NOT_EXECUTED` | not authorized by this PR |',
      '| production DB write | `NOT_PERFORMED` | not authorized by this PR |',
      '- no production DB write.',
      '- no retry execute.',
      '- no cleanup execute.',
      '- no live customer-memory gate enablement.',
      '- no pilot rollout execution.',
      '- no dry-run execution.',
      '- no real-data execute.',
      '- no billing exposure.',
      '- no automation/reporting exposure.',
      '- no external notification.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes the test-stage real-data policy and bounded sample limits', () => {
    [
      '## D. Real-Data Test-Stage Policy',
      '- preferred environment: staging/dev/test Supabase project.',
      '- if only production DB exists, this PR must not write.',
      '- real-data sample must be manually bounded.',
      '- no bulk import.',
      '- no raw PII in output.',
      '- no customer list dump.',
      '- no full UUID output.',
      '- real data must be limited to one owner-approved pilot store.',
      '| stores | 1 | one owner-approved pilot store only |',
      '| customers | 1 to 3 | manually bounded real-data sample only |',
      '| customer_contacts | 1 to 3 | masked contact evidence only |',
      '| customer_timeline_events | 1 to 3 | sanitized event summaries only |',
      '| inquiries/reservations/waiting_entries | optional 1 total | only if separately approved in the next execute step |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('uses canonical store_members access and store_subscriptions entitlement truth while rejecting client-only authority', () => {
    [
      '`store_members` access can be validated.',
      '`store_subscriptions` plan state can be validated.',
      '- entitlement source: `store_subscriptions`.',
      '- access source: `store_members`.',
      '- forbidden authority: browser local state, mock state, and client-only flags.',
      '- all customer-memory behavior must be store-scoped.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines the future dry-run and future small real-data execute as separate unapproved steps', () => {
    [
      '## I. Future Dry-Run Plan Outline',
      'The future dry-run is not approved by this PR.',
      '- read-only or simulation-only unless separately approved.',
      '- no customer row creation.',
      '- no customer_contact row creation.',
      '- no inquiry row creation.',
      '- no timeline row creation.',
      '## J. Future Small Real-Data Execute Outline',
      'The future small real-data execute is not approved by this PR.',
      '- requires separate owner approval phrase.',
      '- must show bounded expected DB effects before execution.',
      '- must not expose raw PII.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes kill-switch conditions, rollback plan, and KPI plan', () => {
    [
      '## K. Kill-Switch Conditions',
      '- raw PII appears in logs/docs/tests.',
      '- full UUID appears in public/report output.',
      '- raw row sample appears.',
      '- `store_members` check is ambiguous.',
      '- `store_subscriptions` check is ambiguous.',
      '- unexpected production DB write occurs.',
      '- cleanup is attempted without approval.',
      '- PR #106 or PR #125 is merged as a side effect.',
      '## L. Rollback Plan',
      '- feature gate remains off by default.',
      '- cleanup requires separate owner approval.',
      '- owner-facing status must show `PASS`, `BLOCKED`, or `ROLLBACK_REQUIRED`.',
      '## M. KPI Plan',
      '| identified customer count | aggregate-only | measure customer-memory identity coverage |',
      '| customer card creation rate | aggregate-only | measure CRM/customer card value |',
      '| customer timeline event creation rate | aggregate-only | measure timeline usefulness |',
      '| duplicate customer rate | aggregate-only | detect identity quality risk |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes all requested sections and next required steps', () => {
    [
      '## A. Current Status',
      '## B. Approval Basis',
      '## C. Pilot Execution Objective',
      '## D. Real-Data Test-Stage Policy',
      '## E. Pilot Candidate Requirements',
      '## F. Execution Boundaries',
      '## G. PRO/VIP Gating Model',
      '## H. Data Safety Plan',
      '## I. Future Dry-Run Plan Outline',
      '## J. Future Small Real-Data Execute Outline',
      '## K. Kill-Switch Conditions',
      '## L. Rollback Plan',
      '## M. KPI Plan',
      '## N. Required Next Approval Phrase',
      '## O. Next Required Step',
      '## P. Explicit Non-Actions',
      '## Q. side_effects JSON',
      'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_REVIEW',
      'WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('does not expose raw PII, raw row samples, or full UUIDs', () => {
    expect(doc).not.toMatch(/\b01[016789]-?\d{3,4}-?\d{4}\b/);
    expect(doc).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(doc).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  });

  it('includes side_effects JSON with all requested false side effects', () => {
    expect(extractSideEffects()).toEqual({
      automation_reporting_exposure_enabled: false,
      billing_exposure_enabled: false,
      cleanup_executed: false,
      customer_memory_gate_enabled: false,
      db_push: false,
      docs_only: true,
      draft_pr_only: true,
      dry_run_executed: false,
      env_auth_payment_webhook_changed: false,
      external_notification_sent: false,
      full_uuid_output: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_REVIEW',
      owner_approval_phrase_consumed_for_execution_plan_pr: true,
      owner_approval_phrase_required: consumedApprovalPhrase,
      pilot_execution_plan_created: true,
      pilot_rollout_executed: false,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      ready_transition: false,
      real_data_execute: false,
      required_next_owner_approval_phrase: nextApprovalPhrase,
      retry_execute: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      sql_replay: false,
      squash_merge: false,
      test_stage_real_data_path_documented: true,
      tests_only: true,
    });
  });
});
