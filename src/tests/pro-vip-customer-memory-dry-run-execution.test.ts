import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const docPath = 'docs/pro-vip-customer-memory-dry-run-execution.md';
const absoluteDocPath = resolve(process.cwd(), docPath);
const docExists = existsSync(absoluteDocPath);
const doc = docExists ? readFileSync(absoluteDocPath, 'utf8') : '';

const decision = 'PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR_DRAFT';
const consumedApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_REAL_DATA_TEST_PLAN_APPROVED';
const nextApprovalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_APPROVED';
const nextReviewStep = 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION_PR_REVIEW';
const postMergeStep = 'WAIT_FOR_OWNER_APPROVAL_PHRASE_FOR_PRO_VIP_CUSTOMER_MEMORY_DRY_RUN_EXECUTION';
const mainHeadAfterPr147 = 'ff57446850579f843306e94e03acc84a7b01e495';

function extractSideEffects() {
  const match = doc.match(/## N\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('PRO/VIP customer-memory dry-run execution PR packet', () => {
  it('creates the required document with the dry-run execution draft decision', () => {
    expect(docExists).toBe(true);
    expect(doc).toContain(`Status: \`${decision}\``);
    expect(doc).toContain('This PR creates dry-run execution artifacts only.');
  });

  it('records the consumed approval phrase and the next approval gate', () => {
    [
      consumedApprovalPhrase,
      'This phrase authorizes creation of the dry-run execution PR only.',
      nextApprovalPhrase,
      'This next phrase authorizes running the dry-run only.',
      'It does not authorize real-data write, production DB write, live gate enablement, cleanup, billing exposure, automation/reporting exposure, or external notification.',
      nextReviewStep,
      postMergeStep,
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents the current baseline and PR #147 production readiness', () => {
    [
      'PR #147 merged.',
      mainHeadAfterPr147,
      'production auto deploy is `READY`.',
      'production GET smoke passed.',
      'no real-data write is performed.',
      'no production DB write is performed.',
      'no live gate is enabled.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines the dry-run as read-only or simulation-only and not executed by this PR', () => {
    [
      'dry-run must remain read-only/simulation-only.',
      'dry-run is not executed by this PR.',
      '- no customer creation.',
      '- no customer_contacts creation.',
      '- no customer_preferences creation.',
      '- no inquiries creation.',
      '- no reservations creation.',
      '- no waiting_entries creation.',
      '- no customer_timeline_events creation.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('uses server-side access and entitlement truth while rejecting browser local state as authority', () => {
    [
      '`store_members` is the access truth.',
      '`store_subscriptions` is the entitlement truth.',
      'browser local state must not be used as authority.',
      'mock state must not be used as authority.',
      'client-only flags must not be used as authority.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines environment classification and pilot store eligibility without printing secrets or identifiers', () => {
    [
      '## D. Environment Classification',
      '- local.',
      '- staging/dev Supabase.',
      '- production Supabase.',
      '- if staging/dev exists, prefer it.',
      '- no secrets or raw connection strings may be printed.',
      '- project IDs must be masked.',
      '- store IDs must be masked.',
      '## E. Pilot Store Eligibility',
      '- owner approval is documented.',
      '- store identifier is masked.',
      '- customer-memory gate remains disabled.',
      '- rollback path exists.',
      '- kill-switch conditions are accepted.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes the required dry-run readiness checks', () => {
    [
      '## F. Dry-Run Expected Checks',
      '- route availability.',
      '- dashboard visibility.',
      '- customer-memory adapter availability.',
      '- store_members readiness.',
      '- store_subscriptions readiness.',
      '- customer card readiness.',
      '- timeline readiness.',
      '- report/dashboard readiness.',
      '- masked evidence output.',
      '- duplicate-risk guard readiness.',
      '- rollback readiness.',
      'dashboard route readiness',
      'report route readiness',
      'kill-switch readiness',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('requires sanitized dry-run output only', () => {
    [
      '## G. Dry-Run Output Format',
      '- `PASS`, `BLOCKED`, or `SKIPPED` status.',
      '- masked store reference.',
      '- boolean readiness flags.',
      '- aggregate counts only.',
      '- no raw customer name.',
      '- no raw phone.',
      '- no raw email.',
      '- no raw row sample.',
      '- no full UUID.',
      '- no secret.',
      '- no token.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes kill-switch conditions, rollback plan, and KPI readiness', () => {
    [
      '## H. Kill-Switch Conditions',
      '- raw PII appears.',
      '- full UUID appears.',
      '- raw row sample appears.',
      '- store_members check is ambiguous.',
      '- store_subscriptions check is ambiguous.',
      '- DB write risk appears.',
      '- live gate risk appears.',
      '- PR #106 or PR #125 is merged as a side effect.',
      '## I. Rollback Plan',
      '- no DB write means no data rollback should be required for this dry-run PR.',
      '- if any future write occurs unexpectedly, status must become `ROLLBACK_REQUIRED`.',
      '- cleanup requires separate approval.',
      '- rollback evidence must be sanitized.',
      '## J. KPI Readiness',
      '| identified customer count |',
      '| customer card creation rate |',
      '| timeline event creation count |',
      '| duplicate customer rate |',
      '| store_members validation result |',
      '| store_subscriptions validation result |',
      '| dashboard visibility |',
      '| PRO conversion signal |',
      '| VIP conversion signal |',
      '| rollback_required count |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('includes all requested sections and explicit non-actions', () => {
    [
      '## A. Current Status',
      '## B. Approval Basis',
      '## C. Dry-Run Execution Objective',
      '## D. Environment Classification',
      '## E. Pilot Store Eligibility',
      '## F. Dry-Run Expected Checks',
      '## G. Dry-Run Output Format',
      '## H. Kill-Switch Conditions',
      '## I. Rollback Plan',
      '## J. KPI Readiness',
      '## K. Required Next Owner Approval Phrase',
      '## L. Next Required Step',
      '## M. Explicit Non-Actions',
      '## N. side_effects JSON',
      '- no production DB write.',
      '- no real-data write.',
      '- no live gate enablement.',
      '- no cleanup.',
      '- no retry execute.',
      '- no billing exposure.',
      '- no automation/reporting exposure.',
      '- no notification.',
      '- no manual deploy.',
      '- no Vercel retry.',
      '- no SQL/RLS/grant execution.',
      '- no migration apply.',
      '- no db push.',
      '- no SQL replay.',
      '- no env/auth/payment/webhook change.',
      '- no sales Excel touch.',
      '- no PR #106 merge.',
      '- no PR #125 merge.',
      '- no raw PII.',
      '- no raw row sample.',
      '- no full UUID output.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('does not expose raw PII or full UUID values', () => {
    expect(doc).not.toMatch(/\b01[016789]-?\d{3,4}-?\d{4}\b/);
    expect(doc).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(doc).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  });

  it('includes side_effects JSON with all requested false side effects', () => {
    expect(extractSideEffects()).toEqual({
      draft_pr_only: true,
      dry_run_execution_pr_created: true,
      dry_run_executed: false,
      real_data_write: false,
      production_db_write: false,
      customer_memory_gate_enabled: false,
      cleanup_executed: false,
      billing_exposure_enabled: false,
      automation_reporting_exposure_enabled: false,
      external_notification_sent: false,
      manual_deploy: false,
      vercel_retry: false,
      rls_or_grant_executed: false,
      migration_apply: false,
      db_push: false,
      sql_replay: false,
      env_auth_payment_webhook_changed: false,
      sales_excel_import_touched: false,
      pr_106_merged: false,
      pr_125_merged: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      full_uuid_output: false,
      owner_approval_phrase_consumed_for_dry_run_execution_pr: true,
      required_next_owner_approval_phrase: nextApprovalPhrase,
      next_required_step: nextReviewStep,
    });
  });
});
