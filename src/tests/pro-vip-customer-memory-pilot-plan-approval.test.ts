import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const docPath = 'docs/pro-vip-customer-memory-pilot-plan-approval.md';
const doc = readFileSync(resolve(process.cwd(), docPath), 'utf8');
const approvalPhrase = 'MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED';
const nextStep = 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_EXECUTION_PLAN';

function extractSideEffects() {
  const match = doc.match(/## M\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('PRO/VIP customer-memory pilot plan approval packet', () => {
  it('keeps the packet in the requested docs/tests-only draft status', () => {
    [
      'Status: `OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_DRAFT`',
      'Branch: `codex/pro-vip-customer-memory-pilot-plan-approval`',
      'This is a docs/tests-only owner approval packet for creating the PRO/VIP customer-memory pilot execution plan.',
      'It does not approve live gate enablement, production DB writes, cleanup, pilot rollout execution, billing exposure, automation/reporting exposure',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('contains every required approval-packet section', () => {
    [
      '## A. Current Status',
      '## B. Pilot Objective',
      '## C. Pilot Scope',
      '## D. Eligible Pilot Store Criteria',
      '## E. PRO/VIP Gating Plan',
      '## F. Data Safety Plan',
      '## G. Approval Phrase',
      '## H. Next Step After This PR',
      '## I. Rollout Phases',
      '## J. Kill-Switch / Rollback Conditions',
      '## K. KPI Plan',
      '## L. Explicit Non-Actions',
      '## M. side_effects JSON',
    ].forEach((heading) => expect(doc).toContain(heading));
  });

  it('records the current status from PR #143 and PR #144 without enabling the live gate', () => {
    [
      '| PR #143 | `MERGED` | contact-only customer-memory proof merged |',
      '| PR #143 decision | `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS` | sanitized aggregate/boolean proof retained |',
      '| PR #144 | `MERGED` | PRO/VIP rollout readiness review merged |',
      '| PR #144 decision | `PRO_VIP_CUSTOMER_MEMORY_ROLLOUT_READINESS_REVIEW_PASS_MERGED` | readiness packet reached `main` |',
      '| production read-only smoke | `PASS` | GET-only smoke returned 200 for `/`, `/pricing`, `/admin/leads`, `/dashboard/customers`, and `/dashboard/ai-reports` |',
      '| live customer-memory gate | `NOT_ENABLED` | remains separately gated |',
      '| pilot rollout | `NOT_EXECUTED` | this packet requests plan approval only |',
      '| PR #106 | `OPEN Draft` | not merged |',
      '| PR #125 | `OPEN Draft` | not merged |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines the pilot objective, scope, and eligible pilot store criteria', () => {
    [
      '- customer-memory value for PRO/VIP conversion.',
      '- CRM and customer timeline usefulness for owner workflows.',
      '- diagnostics, reports, dashboard, and automation-readiness without exposing raw PII.',
      '- `store_members` access checks before any live enablement.',
      '- `store_subscriptions` entitlement checks before any live enablement.',
      '- owner-approved pilot stores only.',
      '- no real customer import unless separately approved.',
      '- no bulk rollout.',
      '- no billing exposure in this plan.',
      '| Store access | `store_members` access can be verified for the selected store | `REQUIRED_BEFORE_ENABLEMENT` |',
      '| Plan entitlement | `store_subscriptions` plan state can be verified for the selected store | `REQUIRED_BEFORE_ENABLEMENT` |',
      '| Rollback path | rollback and kill-switch path is documented | `REQUIRED_BEFORE_ENABLEMENT` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines FREE, PRO, and VIP gating with canonical access and entitlement sources', () => {
    [
      '| FREE | public page, basic inquiry/waiting, limited capture | public route policy plus existing unpaid access policy | `UNCHANGED_BY_THIS_PACKET` |',
      '| PRO candidate | customer CRM, integrated customer card, timeline, basic AI inquiry summary/classification | `store_members` access plus `store_subscriptions` entitlement plus customer-memory gate | `PLAN_ONLY_NOT_ENABLED` |',
      '| VIP candidate | customer preferences, revisit automation, AI reports, upsell recommendation, advanced segmentation | `store_members` access plus `store_subscriptions` entitlement plus customer-memory gate plus automation/reporting approval | `PLAN_ONLY_NOT_ENABLED` |',
      '- entitlement source must be canonical `store_subscriptions`.',
      '- access source must be canonical `store_members`.',
      '- browser local state must not be treated as truth.',
      '- billing exposure must remain disabled until explicit billing exposure approval.',
      '- automation/reporting exposure must remain disabled until explicit automation/reporting approval.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps all customer-memory evidence sanitized and aggregate-only until approval', () => {
    [
      '- sanitized aggregate/boolean proof only.',
      '- masked contact evidence only.',
      '- no raw PII in docs, tests, logs, or PR text.',
      '- no raw customer/contact/inquiry/timeline row samples.',
      '- no full UUID output.',
      '- no production data export.',
      '- no cleanup until separately approved.',
      '- contact linkage proof summaries.',
      '- customer card readiness summaries.',
      '- inquiry and waiting aggregates.',
      '- rollback and kill-switch evidence.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records the exact owner approval phrase and its limited meaning', () => {
    [
      'Required owner approval phrase for the next step:',
      approvalPhrase,
      'Important: this phrase approves creation of the pilot execution plan only.',
      '- live customer-memory gate enablement.',
      '- production DB write.',
      '- cleanup/delete.',
      '- pilot rollout execution.',
      '- PRO/VIP billing exposure.',
      '- automation/reporting exposure.',
      '- external notification.',
      nextStep,
      'The next step may begin only after the approval phrase in section G is provided by the owner.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines rollout phases, rollback conditions, and KPI plan', () => {
    [
      '| 1 | Plan approval packet | this docs/tests-only packet | Draft PR only |',
      '| 2 | Pilot execution plan | create the exact pilot runbook, targets, gates, rollback, and validation checklist | requires `MYBIZ_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN_APPROVED` |',
      '| 3 | One owner-approved pilot store dry-run | read-only/dry-run validation for one selected store | requires pilot execution plan approval |',
      '| 4 | One owner-approved pilot store execute | one bounded execution against the approved store | requires separate execute approval |',
      '| 7 | PRO/VIP expansion decision | decide pause, rollback, or expanded rollout | requires separate expansion approval |',
      '- any raw PII leak.',
      '- any `store_members` mismatch.',
      '- any `store_subscriptions` mismatch.',
      '- any unexpected DB write.',
      '- any billing exposure before approval.',
      '- any notification before approval.',
      '| identified customer count | aggregate-only | measure whether customer-memory creates useful customer identity coverage |',
      '| PRO conversion signal | aggregate-only | measure paid upgrade intent for PRO features |',
      '| VIP conversion signal | aggregate-only | measure paid upgrade intent for VIP features |',
      '| owner weekly active usage | aggregate-only | measure sustained owner engagement |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records explicit non-actions and excludes raw PII, row samples, and full UUIDs', () => {
    [
      '- write to production DB.',
      '- enable the live customer-memory gate.',
      '- execute cleanup/delete.',
      '- execute retry.',
      '- execute a pilot rollout.',
      '- enable billing exposure.',
      '- enable automation/reporting exposure.',
      '- apply migrations.',
      '- push DB changes.',
      '- replay SQL.',
      '- change env/auth/payment/webhook behavior.',
      '- send external notifications.',
      '- touch sales Excel.',
      '- merge PR #106.',
      '- merge PR #125.',
      '- run a manual deploy.',
      '- print raw PII.',
      '- print raw row samples.',
      '- print full UUIDs.',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(doc).not.toMatch(/\b01[016789]-?\d{3,4}-?\d{4}\b/);
    expect(doc).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(doc).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  });

  it('matches the required side-effects matrix exactly', () => {
    expect(extractSideEffects()).toEqual({
      automation_reporting_exposure_enabled: false,
      billing_exposure_enabled: false,
      cleanup_executed: false,
      customer_memory_gate_enabled: false,
      db_push: false,
      docs_only: true,
      draft_pr_only: true,
      env_auth_payment_webhook_changed: false,
      external_notification_sent: false,
      full_uuid_output: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: nextStep,
      pilot_rollout_executed: false,
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      ready_transition: false,
      required_owner_approval_phrase: approvalPhrase,
      retry_execute: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      sql_replay: false,
      squash_merge: false,
      tests_only: true,
    });
  });
});
