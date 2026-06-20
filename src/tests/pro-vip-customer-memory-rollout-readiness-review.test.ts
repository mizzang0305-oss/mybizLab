import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const docPath = 'docs/pro-vip-customer-memory-rollout-readiness-review.md';
const doc = readFileSync(resolve(process.cwd(), docPath), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## L\. side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('PRO/VIP customer-memory rollout readiness review packet', () => {
  it('keeps the packet docs/tests-only and records current PR #143 status', () => {
    [
      'Status: `PRO_VIP_CUSTOMER_MEMORY_ROLLOUT_READINESS_REVIEW_DRAFT`',
      'Branch: `codex/pro-vip-customer-memory-rollout-readiness-review`',
      '| PR #143 | `MERGED` | contact-only proof packet reached `main` |',
      '| PR #143 decision | `SYNTHETIC_CUSTOMER_MEMORY_CONTACT_ONLY_RETRY_PASS` | sanitized proof retained |',
      '| live customer-memory gate | `NOT_ENABLED` | remains separately gated |',
      '| PR #106 | `OPEN Draft` | not merged |',
      '| PR #125 | `OPEN Draft` | not merged |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('contains every required readiness-review section', () => {
    [
      '## A. Current Status',
      '## B. Proof Retained From PR #143',
      '## C. Product Interpretation',
      '## D. PRO/VIP Gating Matrix',
      '## E. Data Safety Matrix',
      '## F. Route/Read-Only Smoke Matrix',
      '## G. Required Approvals',
      '## H. Rollout Phases',
      '## I. Rollback Plan',
      '## J. KPI Plan',
      '## K. Explicit Non-Actions',
      '## L. side_effects JSON',
    ].forEach((heading) => expect(doc).toContain(heading));
  });

  it('answers what PR #143 proves and what it does not prove', () => {
    [
      'PR #143 proves only the non-PII contact path for the dedicated synthetic test-store scope.',
      '- `customers` delta: `+0`.',
      '- `customer_contacts` delta: `+1`.',
      '- `inquiries` delta: `+0`.',
      '- `customer_timeline_events` delta: `+0`.',
      '- wrong-store count: `0`.',
      '- live customer-memory gate enablement.',
      '- broad PRO/VIP rollout.',
      '- public inquiry, reservation, waiting, automation, reporting, or billing exposure.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('defines PRO/VIP candidates and the store membership plus subscription gates', () => {
    [
      '| `/dashboard/customers` customer list and detail | `PRO` and `VIP` | `store_members` plus `store_subscriptions` plus customer-memory gate | `REVIEW_READY_NOT_ENABLED` |',
      '| Customer timeline and contact history | `PRO` and `VIP` | `store_members` plus customer-memory gate | `REVIEW_READY_NOT_ENABLED` |',
      '| Public inquiry capture into customer memory | `PRO` and `VIP` | `store_subscriptions` plus public write approval plus customer-memory gate | `BLOCKED_PENDING_APPROVAL` |',
      '| `/dashboard/ai-reports` customer-memory reporting | `PRO` and `VIP` | `store_members` plus `store_subscriptions` plus aggregate-only reporting policy | `REVIEW_READY_NOT_ENABLED` |',
      '| Paid feature eligibility | active canonical `store_subscriptions` row with `pro` or `vip` plan | `REQUIRED_BEFORE_PILOT` |',
      '| Dashboard customer-memory reads | matching `store_members` row for the requested store | `REQUIRED_BEFORE_PILOT` |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps customer-memory paths sanitized and aggregate-only until approval', () => {
    [
      'Customer-memory paths that must remain sanitized and aggregate-only until approval:',
      '- contact proof summaries.',
      '- customer timeline proof summaries.',
      '- inquiry and reservation aggregates.',
      '- dashboard customer counts and segment counts.',
      '- AI report trend metrics.',
      '- automation job summaries.',
      'These paths must not print raw customer names, raw phone numbers, raw emails, raw contact values, raw row samples, raw full store identifiers, secrets, tokens, or payment payloads.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('records route smoke, required approvals, rollout phases, rollback, and KPI plan', () => {
    [
      '| `/` | `GET` | `200` | `false` |',
      '| `/pricing` | `GET` | `200` | `false` |',
      '| `/admin/leads` | `GET` | `200` | `false` |',
      '| `/dashboard/customers` | `GET` | `200` | `false` |',
      '| `/dashboard/ai-reports` | `GET` | `200` | `false` |',
      'APPROVE_LIVE_CUSTOMER_MEMORY_GATE_ENABLEMENT_FOR_PRO_VIP_PILOT',
      'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CLEANUP_DELETE',
      'APPROVE_PRO_VIP_CUSTOMER_MEMORY_PILOT_STORE_ROLLOUT',
      'APPROVE_PRO_VIP_BILLING_EXPOSURE_FOR_CUSTOMER_MEMORY',
      'APPROVE_PRO_VIP_CUSTOMER_MEMORY_AUTOMATION_REPORTING_EXPOSURE',
      '| Phase 3 | live gate canary | separate live gate approval | one bounded pilot-store write path succeeds with sanitized read-back |',
      '- define a stop condition for any cross-store count mismatch, wrong-store read, raw PII log, row cap breach, non-target table write, webhook/payment side effect, or external notification attempt.',
      '| customer-memory contact linkage rate | aggregate-only | confirm contact rows link to the intended store/customer path |',
      '| PRO/VIP conversion lift | aggregate-only | connect customer-memory value to paid plan conversion |',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('keeps explicit non-actions and prohibited raw evidence out of the packet', () => {
    [
      '- write to production DB.',
      '- execute a customer-memory retry.',
      '- execute cleanup/delete.',
      '- enable the live customer-memory gate.',
      '- print raw PII.',
      '- print raw row samples.',
      '- print full UUIDs.',
      '- run a manual deploy.',
      '- merge PR #106.',
      '- merge PR #125.',
    ].forEach((expected) => expect(doc).toContain(expected));

    expect(doc).not.toMatch(/\b01[016789]-?\d{3,4}-?\d{4}\b/);
    expect(doc).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(doc).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  });

  it('matches the requested side-effects matrix', () => {
    expect(extractSideEffects()).toEqual({
      cleanup_executed: false,
      customer_memory_gate_enabled: false,
      db_push: false,
      docs_only: true,
      env_auth_payment_webhook_changed: false,
      external_notification_sent: false,
      full_uuid_output: false,
      manual_deploy: false,
      migration_apply: false,
      next_required_step: 'OWNER_APPROVAL_FOR_PRO_VIP_CUSTOMER_MEMORY_PILOT_PLAN',
      pr_106_merged: false,
      pr_125_merged: false,
      production_db_write: false,
      raw_pii_output: false,
      raw_row_sample_output: false,
      retry_execute: false,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      sql_replay: false,
      tests_only: true,
    });
  });
});
