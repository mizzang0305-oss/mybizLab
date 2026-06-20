import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const docPath = 'docs/pro-vip-customer-memory-dry-run-real-data-test-plan.md';
const absoluteDocPath = resolve(process.cwd(), docPath);
const doc = readFileSync(absoluteDocPath, 'utf8');

const decision = 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN_DRAFT';
const consumedApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN_APPROVED';
const nextDryRunApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_APPROVED';
const laterRealDataExecutePhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_SMALL_REAL_DATA_TEST_EXECUTE_APPROVED';

function extractSideEffects() {
  const match = doc.match(/## Q\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('PRO/VIP customer-memory dry-run and real-data-test plan packet', () => {
  it('creates the required document with the dry-run and real-data-test plan draft decision', () => {
    expect(existsSync(absoluteDocPath)).toBe(true);
    expect(doc).toContain(`Status: \`${decision}\``);
    expect(doc).toContain('This docs/tests-only PR creates the PRO/VIP customer-memory dry-run and real-data-test plan only.');
  });

  it('records the consumed approval phrase and next approval phrases with narrow authorization', () => {
    [
      consumedApprovalPhrase,
      'This phrase authorizes creation of the dry-run and real-data-test plan PR only.',
      nextDryRunApprovalPhrase,
      laterRealDataExecutePhrase,
      'The next dry-run approval phrase authorizes read-only/simulation dry-run execution only.',
      'The later real-data execute phrase remains separate and inactive in this PR.',
      'It does not authorize:',
      '- production DB write.',
      '- live customer-memory gate enablement.',
      '- dry-run execution.',
      '- real-data execute.',
      '- cleanup.',
      '- billing exposure.',
      '- automation/reporting exposure.',
      '- external notification.',
      '- bulk customer import.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('states this PR does not execute any dry-run, write, gate, cleanup, billing, or notification path', () => {
    [
      '| this PR scope | `DRY_RUN_AND_REAL_DATA_TEST_PLAN_ONLY` | creates documentation and tests only |',
      '| live customer-memory gate | `NOT_ENABLED` | remains separately gated |',
      '| dry-run execution | `NOT_EXECUTED` | not authorized by this PR |',
      '| small real-data execute | `NOT_EXECUTED` | requires later separate approval |',
      '| production DB write | `NOT_PERFORMED` | not authorized by this PR |',
      '- no production DB write.',
      '- no live customer-memory gate enablement.',
      '- no dry-run execution.',
      '- no real-data execute.',
      '- no cleanup execute.',
      '- no billing exposure.',
      '- no automation/reporting exposure.',
      '- no external notification.',
      '- no PR #106 merge.',
      '- no PR #125 merge.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines the dry-run plan as read-only or simulation-only with sanitized proof', () => {
    [
      '## D. Dry-Run Plan',
      '- mode: read-only or simulation-only.',
      '- no customer row creation.',
      '- no customer_contact row creation.',
      '- no inquiry row creation.',
      '- no timeline row creation.',
      '- no live gate enablement.',
      '- evidence output: aggregate/boolean proof only.',
      '- env readiness output: `CONFIGURED` or `MISSING` only.',
      '| environment classification | read-only | determine staging/dev/test versus production boundary |',
      '| store_members access | boolean-only | prove tenant access is unambiguous |',
      '| store_subscriptions entitlement | boolean-only | prove PRO/VIP entitlement source is available |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines the small real-data test plan as bounded and separately approved', () => {
    [
      '## E. Small Real-Data Test Plan',
      '- requires the later real-data execute approval phrase.',
      '- one owner-approved pilot store only.',
      '- manually bounded sample only.',
      '- expected DB effects must be shown before execution.',
      '- rollback and kill-switch must be confirmed before execution.',
      '| stores | 1 | one owner-approved pilot store only |',
      '| customers | 1 to 3 | manually selected and masked evidence only |',
      '| customer_contacts | 1 to 3 | masked contact evidence only |',
      '| customer_timeline_events | 1 to 3 | sanitized event summaries only |',
      '| inquiries/reservations/waiting_entries | optional 1 total | only if separately approved in the execute step |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps PRO/VIP authority server-side and store-scoped', () => {
    [
      '- entitlement source: `store_subscriptions`.',
      '- access source: `store_members`.',
      '- forbidden authority: browser local state, mock state, client-only flags, and owner-facing copy alone.',
      '- all customer-memory behavior must be store-scoped.',
      '- plan-based gating must remain preserved for paid surfaces.',
      '- customer-memory gate enablement remains blocked until separate owner approval.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes validation checklist, kill-switch conditions, rollback plan, and KPI plan', () => {
    [
      '## H. Validation Checklist',
      '- targeted contract test passes.',
      '- full lint/typecheck/build/test bundle passes before PR handoff when feasible.',
      '- value-based secret and PII scan is clean for staged files.',
      '## K. Kill-Switch Conditions',
      '- raw PII appears in logs/docs/tests.',
      '- full UUID appears in public/report output.',
      '- raw row sample appears.',
      '- `store_members` check is ambiguous.',
      '- `store_subscriptions` check is ambiguous.',
      '- unexpected production DB write occurs.',
      '## L. Rollback Plan',
      '- dry-run can stop with no data cleanup because it is read-only/simulation-only.',
      '- real-data cleanup requires separate owner approval.',
      '## M. KPI Plan',
      '| PRO conversion signal | aggregate-only | connect customer-memory value to paid plan conversion |',
      '| VIP conversion signal | aggregate-only | connect advanced customer-memory value to higher plan conversion |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes all requested sections and next required steps', () => {
    [
      '## A. Current Status',
      '## B. Approval Basis',
      '## C. Plan Objective',
      '## D. Dry-Run Plan',
      '## E. Small Real-Data Test Plan',
      '## F. Pilot Candidate Requirements',
      '## G. PRO/VIP Gating Model',
      '## H. Validation Checklist',
      '## I. Data Safety Plan',
      '## J. Future Execution Gates',
      '## K. Kill-Switch Conditions',
      '## L. Rollback Plan',
      '## M. KPI Plan',
      '## N. Required Next Approval Phrases',
      '## O. Next Required Step',
      '## P. Explicit Non-Actions',
      '## Q. side_effects JSON',
      'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN_REVIEW',
      'WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_EXECUTION',
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
      dry_run_and_real_data_test_plan_created: true,
      dry_run_executed: false,
      env_auth_payment_webhook_changed: false,
      external_notification_sent: false,
      full_uuid_output: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_DRY_RUN_AND_REAL_DATA_TEST_PLAN_REVIEW',
      owner_approval_phrase_consumed_for_dry_run_and_real_data_test_plan_pr: true,
      owner_approval_phrase_required: consumedApprovalPhrase,
      pilot_rollout_executed: false,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      ready_transition: false,
      real_data_execute: false,
      required_later_real_data_execute_approval_phrase: laterRealDataExecutePhrase,
      required_next_owner_approval_phrase: nextDryRunApprovalPhrase,
      retry_execute: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      small_real_data_test_plan_documented: true,
      sql_replay: false,
      squash_merge: false,
      tests_only: true,
    });
  });
});
