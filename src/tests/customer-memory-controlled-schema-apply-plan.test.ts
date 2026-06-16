import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-controlled-schema-apply-plan.md');
const migration = readWorkspaceFile('supabase/migrations/20260615075421_customer_memory_schema_alignment.sql');

describe('customer memory controlled schema apply plan', () => {
  it('documents the controlled plan around the existing approval-gated draft migration', () => {
    expect(existsSync(workspacePath('supabase/migrations/20260615075421_customer_memory_schema_alignment.sql'))).toBe(
      true,
    );
    expect(readdirSync(workspacePath('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);

    expect(doc).toContain('Plan status: `APPLY_NOT_APPROVED`');
    expect(doc).toContain('Draft migration under review: `20260615075421_customer_memory_schema_alignment.sql`');
    expect(doc).toContain('No new migration file is added by this PR.');
  });

  it('maps required change categories and production evidence without row samples', () => {
    for (const item of [
      'dedupe index',
      'customer_contacts alignment',
      'timeline payload policy',
      'RLS hardening',
      'grants hardening',
    ]) {
      expect(doc).toContain(item);
    }

    expect(doc).toContain('Production evidence mode: catalog metadata only');
    expect(doc).toContain('`customer_contacts.store_id`: missing');
    expect(doc).toContain('Duplicate contact audit: `NOT_RUN_REQUIRES_APPROVAL`');
    expect(doc).toContain('No `SELECT *`, row samples, normalized contact values, raw customer data, or raw PII were collected.');
  });

  it('separates the apply phases and keeps canary write blocked', () => {
    for (const phase of [
      'Phase A: index/constraint readiness',
      'Phase B: adapter compatibility',
      'Phase C: RLS/grant hardening',
      'Phase D: canary write',
    ]) {
      expect(doc).toContain(phase);
    }

    expect(doc).toContain('Canary write status: `BLOCKED_PENDING_OWNER_APPROVAL`');
    expect(doc).toContain('`liveCustomerMemoryWriteEnabled=false`');
  });

  it('keeps draft SQL non-destructive while acknowledging DML requires approval', () => {
    expect(migration).toContain('DRAFT ONLY');
    expect(migration).toContain('update public.customer_contacts');
    expect(doc).toContain('DML backfill requires an approved apply window');

    const executableSql = migration
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('--'))
      .join('\n');

    expect(executableSql).not.toMatch(/\bdrop\s+/i);
    expect(executableSql).not.toMatch(/\btruncate\s+/i);
    expect(executableSql).not.toMatch(/\bdelete\s+from\b/i);
    expect(executableSql).not.toMatch(/\bgrant\s+/i);
    expect(executableSql).not.toMatch(/\brevoke\s+/i);
    expect(executableSql).not.toMatch(/\bcreate\s+policy\b/i);
  });

  it('includes risk, rollback, approval checklist, and forbidden operations', () => {
    expect(doc).toContain('## Risk Table');
    expect(doc).toContain('## Rollback Plan');
    expect(doc).toContain('## Approval Checklist');
    expect(doc).toContain('## Forbidden Operations');

    for (const forbidden of [
      'production DB write',
      'npx supabase migration repair',
      'npx supabase db push',
      'npx supabase migration up',
      'SQL replay',
      'RLS policy apply',
      'GRANT/REVOKE',
      'live customer memory write',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('records false side effects for plan-only work', () => {
    expect(doc).toContain('"production_db_write": false');
    expect(doc).toContain('"migration_apply": false');
    expect(doc).toContain('"db_push": false');
    expect(doc).toContain('"migration_repair": false');
    expect(doc).toContain('"sql_replay": false');
    expect(doc).toContain('"rls_or_grant_executed": false');
    expect(doc).toContain('"live_customer_memory_write": false');
    expect(doc).toContain('"sales_excel_import_touched": false');
  });
});
