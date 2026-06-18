import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(resolve(process.cwd(), 'docs/customer-memory-adapter-projection-fix.md'), 'utf8');
const adapter = readFileSync(resolve(process.cwd(), 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts'), 'utf8');

function extractSideEffects() {
  const match = doc.match(/## side_effects JSON\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    throw new Error('side_effects JSON block missing');
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

function tableSelects(table: string) {
  return [...adapter.matchAll(new RegExp(`from\\('${table}'\\)\\s*\\.select\\(\\s*'([^']+)'`, 'g'))].map((match) => match[1]);
}

describe('customer-memory adapter projection fix packet', () => {
  it('records the PR #130 partial-write baseline without row samples or raw PII', () => {
    [
      'PR #130 decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_BLOCKED_PARTIAL_CUSTOMER_UPSERT`',
      'one execute attempt only: `true`',
      'production DB write in PR #130: `true`',
      '`customers` delta in PR #130: `+1`',
      '`customer_contacts` delta in PR #130: `+0`',
      '`inquiries` delta in PR #130: `+0`',
      '`customer_timeline_events` delta in PR #130: `+0`',
      'blocker: `column customers.id does not exist`',
      'retry after blocker: `false`',
      'cleanup/delete after blocker: `false`',
      'raw PII output: `false`',
      'customer row sample output: `false`',
      'This PR intentionally does not inspect or output that row.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('documents the live schema identifier mapping from read-only catalog metadata', () => {
    [
      'production `information_schema.columns` metadata query',
      'target tables only: `customers`, `customer_contacts`, `inquiries`, `customer_timeline_events`',
      'no `SELECT *`',
      '`customers.id` is absent; `customer_id` is the live customer identifier.',
      '`customer_contacts.id` exists as the contact row id; `customer_id` references `customers.customer_id`.',
      '`inquiries.id` exists as the inquiry row id; `customer_id` references `customers.customer_id`.',
      '`customer_timeline_events.id` exists as the event row id; `customer_id` references `customers.customer_id`.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('removes the invalid customers.id projection from production adapter customer reads', () => {
    const customersSelects = tableSelects('customers');

    expect(customersSelects).toContain('customer_id,store_id');
    expect(customersSelects).toContain(
      'customer_id,store_id,customer_key,name,normalized_phone,normalized_email,visit_count,is_regular,marketing_consent,first_seen_at,last_seen_at,updated_at',
    );
    expect(customersSelects).not.toContain('customer_id,id,store_id');
    expect(customersSelects).not.toContain(
      'customer_id,id,store_id,customer_key,name,phone,email,phone_snapshot,visit_count,last_visit_at,is_regular,marketing_opt_in,marketing_consent,first_seen_at,last_seen_at,created_at,updated_at',
    );
    expect(customersSelects.every((select) => !select.split(',').includes('id'))).toBe(true);
  });

  it('keeps target table projections explicit and aligned to live reference columns', () => {
    expect(tableSelects('customer_contacts')).toContain(
      'id,store_id,customer_id,contact_type,raw_value,normalized_value,is_primary,is_verified,created_at',
    );
    expect(tableSelects('inquiries')).toContain(
      'id,store_id,customer_id,conversation_session_id,visitor_session_id,contact_name,contact_phone,contact_email,category,intent,status,message,summary,subject,tags,memo,marketing_opt_in,requested_visit_date,source,channel,created_at,updated_at',
    );
    expect(tableSelects('customer_timeline_events')).toContain(
      'id,store_id,customer_id,event_type,payload,created_at,source,summary,occurred_at',
    );

    expect(adapter).not.toContain('id,customer_id,contact_type,type');
    expect(adapter).not.toContain('customer_name,contact_name,phone,contact_phone,email,contact_email');
  });

  it('forbids wildcard reads, public API writes, retry, cleanup, and schema operations in this packet', () => {
    ['customers', 'customer_contacts', 'inquiries', 'customer_timeline_events'].forEach((table) => {
      expect(adapter).not.toContain(`from('${table}').select('*')`);
      expect(adapter).not.toContain(`from("${table}").select("*")`);
      expect(doc).not.toContain(`from('${table}').select('*')`);
    });

    [
      'public API write route call: `false`',
      'Retry status in this PR: `BLOCKED_PENDING_FRESH_OWNER_APPROVAL`',
      'This PR does not run the harness.',
      'cleanup/delete is explicitly out of scope for this PR',
      'No schema migration, RLS/grant change, public API write route, harness execute, retry, or cleanup is included.',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('retains the partial synthetic customer until separate owner-approved cleanup', () => {
    [
      'Decision: retain the partial synthetic `customers` row from PR #130 for now.',
      'deleting it would require a separate owner approval and a separate sanitized evidence record',
      '`customers` marker-scoped pre-count may be `1`',
      'next approved retry may produce `customers +0` if the existing synthetic row is updated, or `customers +1` at maximum',
      '`customer_contacts` expected retry delta: `+1` max',
      '`inquiries` expected retry delta: `+1` max',
      '`customer_timeline_events` expected retry delta: `+1~2` max',
    ].forEach((expected) => expect(doc).toContain(expected));
  });

  it('requires a fresh owner approval before any retry with the fixed adapter', () => {
    expect(doc).toContain('APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER');
    expect(extractSideEffects()).toMatchObject({
      canary_retry_executed: false,
      cleanup_executed: false,
      partial_synthetic_customer_retained: true,
      retry_requires_fresh_owner_approval: true,
    });
  });

  it('does not add raw PII logging to the production adapter', () => {
    expect(adapter).not.toMatch(/\bconsole\.(log|warn|error)\b/);
    expect(doc).toContain('no raw PII');
    expect(doc).toContain('no raw full `store_id`');
  });

  it('matches the required side-effects matrix for this fix-only PR', () => {
    expect(extractSideEffects()).toEqual({
      adapter_projection_fixed: true,
      canary_retry_executed: false,
      cleanup_executed: false,
      customer_contact_row_created: false,
      customer_row_created: false,
      customer_row_sample_output: false,
      db_push: false,
      env_auth_payment_webhook_changed: false,
      inquiry_row_created: false,
      live_customer_memory_gate_enabled: false,
      manual_deploy: false,
      migration_apply: false,
      partial_synthetic_customer_retained: true,
      pr_106_merged: false,
      production_db_write: false,
      public_api_write_call: false,
      raw_pii_output: false,
      retry_requires_fresh_owner_approval: true,
      rls_or_grant_executed: false,
      sales_excel_import_touched: false,
      schema_changed: false,
      sql_replay: false,
      timeline_row_created: false,
    });
  });
});
