import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveCustomerMemorySpineWriteDecision } from '@/server/mybiz/repositories/customerRepository';
import { resolveCustomerMemoryWriteApproval } from '@/server/mybiz/repositories/types';
import { LAUNCH_GATES } from '@/shared/lib/launchGates';

const DOC_PATH = resolve(process.cwd(), 'docs/customer-memory-schema-alignment-proposal.md');
const ACTIVE_MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');

const REQUIRED_SECTIONS = [
  '## 1. Current Production Evidence Summary',
  '## 2. Required Production Model For PRO/VIP Customer Memory',
  '## 3. Store Isolation Strategy',
  '## 4. Customer Dedupe Strategy',
  '## 5. Contact Normalization Strategy',
  '## 6. Inquiry-To-Customer Linkage Strategy',
  '## 7. Timeline Event Persistence Strategy',
  '## 8. RLS/Grant Hardening Proposal',
  '## 9. Adapter-First Alternative',
  '## 10. Schema-Alignment Migration Proposal',
  '## 11. Rollback Plan',
  '## 12. Approval Checklist',
  '## 13. Launch Gate Criteria',
] as const;

const REQUIRED_BLOCKERS = [
  'BLOCKED_RLS_OR_GRANT_RISK',
  'BLOCKED_DEDUPE_INDEX_MISSING',
  'BLOCKED_MISSING_COLUMN',
  'BLOCKED_TIMELINE_LINKAGE',
] as const;

function readProposal() {
  return readFileSync(DOC_PATH, 'utf8');
}

function parseSideEffects(doc: string) {
  const match = doc.match(/## side_effects\s+```json\s+([\s\S]*?)\s+```/);
  expect(match).not.toBeNull();
  return JSON.parse(match?.[1] || '{}') as Record<string, boolean>;
}

describe('customer memory schema alignment proposal', () => {
  it('contains every required approval-gated design section', () => {
    const doc = readProposal();

    for (const section of REQUIRED_SECTIONS) {
      expect(doc).toContain(section);
    }
  });

  it('maps every PR 108 blocker and keeps readiness blocked', () => {
    const doc = readProposal();

    for (const blocker of REQUIRED_BLOCKERS) {
      expect(doc).toContain(blocker);
    }

    expect(doc).toContain('Overall readiness remains `BLOCKED_MISSING_COLUMN`');
    expect(doc).toContain('Final launch decision remains `LIVE_CUSTOMER_MEMORY_WRITE_BLOCKED`');
  });

  it('keeps live launch blocked by source gates and repository approvals', () => {
    expect(LAUNCH_GATES.broadDbWriteEnabled).toBe(false);
    expect(LAUNCH_GATES.customerMemorySpineEnabled).toBe(true);
    expect(LAUNCH_GATES.liveCustomerMemoryWriteEnabled).toBe(false);

    expect(resolveCustomerMemorySpineWriteDecision()).toMatchObject({
      allowed: false,
      reason: 'BROAD_DB_WRITE_DISABLED',
    });

    expect(resolveCustomerMemoryWriteApproval()).toMatchObject({
      allowed: false,
      reason: 'LAUNCH_GATE_DISABLED',
    });
  });

  it('documents and tracks an approval-gated draft migration file', () => {
    const doc = readProposal();
    const activeMigrations = readdirSync(ACTIVE_MIGRATIONS_DIR);
    const draftMigrations = activeMigrations.filter((name) => name.endsWith('_customer_memory_schema_alignment.sql'));

    expect(doc).toContain('DRAFT SQL ONLY - DO NOT EXECUTE FROM THIS DOCUMENT');
    expect(doc).toContain('add column if not exists store_id');
    expect(doc).toContain('customer_contacts_store_phone_unique');
    expect(doc).toContain('customer_contacts_store_email_unique');
    expect(doc).toContain('draft migration file was added');
    expect(activeMigrations).toContain('20260614_production_baseline_adoption.sql');
    expect(draftMigrations).toHaveLength(1);
    expect(existsSync(resolve(ACTIVE_MIGRATIONS_DIR, draftMigrations[0] || ''))).toBe(true);
  });

  it('keeps production write, migration, RLS/grant, and live-write actions forbidden', () => {
    const doc = readProposal();

    expect(doc).toContain('Supabase `db push`');
    expect(doc).toContain('migration repair');
    expect(doc).toContain('migration apply');
    expect(doc).toContain('SQL replay');
    expect(doc).toContain('RLS policy apply');
    expect(doc).toContain('GRANT/REVOKE');
    expect(doc).toContain('production DB writes');
    expect(doc).toContain('live customer memory write enablement');
    expect(doc).toContain('customer or lead production row creation');
  });

  it('keeps raw PII out of the proposal and requires sanitized logging', () => {
    const doc = readProposal();

    expect(doc).toContain('raw PII output');
    expect(doc).toContain('logs, docs, telemetry, and error messages must use masked or structural values only');
    expect(doc).not.toMatch(/[A-Z0-9._%+-]+@example\.com/i);
    expect(doc).not.toMatch(/\b010[-\s]?\d{3,4}[-\s]?\d{4}\b/);
  });

  it('records side effects as false while allowing only plan-only work', () => {
    const sideEffects = parseSideEffects(readProposal());

    expect(sideEffects).toMatchObject({
      production_db_write: false,
      migration_apply: false,
      db_push: false,
      migration_repair: false,
      sql_replay: false,
      rls_or_grant_executed: false,
      live_customer_memory_write: false,
      live_lead_write: false,
      env_auth_payment_webhook_changed: false,
      customer_or_lead_data_created: false,
      raw_pii_output: false,
      sales_excel_import_touched: false,
      migration_file_added: true,
      approval_gated_followup_only: true,
    });
  });

  it('recommends schema alignment for launch while keeping adapter-first as a non-launch alternative', () => {
    const doc = readProposal();

    expect(doc).toContain('SCHEMA_ALIGNMENT_RECOMMENDED_BEFORE_LIVE_WRITE');
    expect(doc).toContain('adapter-first is now implemented for compatibility');
    expect(doc).toContain('not sufficient by itself to launch live PRO/VIP persistence');
  });
});
