import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/baseline-marker-adoption-preflight.md');
const baselineMarker = readWorkspaceFile('supabase/migrations/20260614_production_baseline_adoption.sql');
const schemaAlignmentDraft = readWorkspaceFile(
  'supabase/migrations/20260615075421_customer_memory_schema_alignment.sql',
);
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('baseline marker adoption preflight', () => {
  it('records the current active migration set as the expected post-PR109 state', () => {
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
    ]);

    expect(doc).toContain('Active migration count: `2`');
    expect(doc).toContain('`20260614_production_baseline_adoption.sql`');
    expect(doc).toContain('`20260615075421_customer_memory_schema_alignment.sql`');
    expect(doc).toContain('Adoption readiness: `BASELINE_MARKER_REPAIR_READY_WITH_PENDING_SCHEMA_ALIGNMENT`');
    expect(doc).toContain('the observed two local-only migrations match the expected post-PR #109 state');
  });

  it('documents remote migration history evidence without requiring production row samples', () => {
    expect(doc).toContain('Supabase CLI: `2.106.0`');
    expect(doc).toContain('Remote applied rows from `npx supabase migration list --linked`: `0`');
    expect(doc).toContain('Local-only rows from `npx supabase migration list --linked`: `2`');
    expect(doc).toContain('`supabase_migrations.schema_migrations` relation exists: `false`');
    expect(doc).toContain('No `SELECT *`, row samples, customer rows, lead rows, or raw PII were collected.');
  });

  it('keeps baseline marker repair as proposal only and excludes schema alignment repair', () => {
    expect(doc).toContain('# PROPOSAL ONLY. DO NOT RUN FROM THIS PR.');
    expect(doc).toContain('npx supabase migration repair 20260614 --status applied --linked');
    expect(doc).toContain('Repair executed: `false`');
    expect(doc).toContain('does not include `20260615075421`');

    expect(doc).not.toMatch(/npx supabase migration repair 20260615075421 --status applied --linked/);
    expect(doc).not.toMatch(/npx supabase migration repair --status applied 20260615075421 --linked/);
  });

  it('proves the baseline marker is comment-only and the schema alignment migration remains pending', () => {
    const executableBaselineSql = baselineMarker
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('--'));

    expect(executableBaselineSql).toEqual([]);
    expect(doc).toContain('`20260614_production_baseline_adoption.sql` remains comment-only/no-op');
    expect(doc).toContain('DDL: none');
    expect(doc).toContain('DML: none');
    expect(doc).toContain('GRANT/REVOKE: none');

    expect(schemaAlignmentDraft).toContain('DRAFT ONLY');
    expect(schemaAlignmentDraft).toContain('has NOT been applied to production');
    expect(schemaAlignmentDraft).toContain('Do not run `npx supabase db push`');
    expect(doc).toContain('must remain local-only pending until a separate schema apply approval exists');
  });

  it('keeps apply, db push, SQL replay, RLS/grant execution, and live writes forbidden', () => {
    expect(doc).toContain('`npx supabase db push`');
    expect(doc).toContain('`npx supabase migration up`');
    expect(doc).toContain('SQL migration body replay');
    expect(doc).toContain('RLS policy apply');
    expect(doc).toContain('GRANT/REVOKE');
    expect(doc).toContain('live customer memory write');
    expect(doc).toContain('live lead write');
    expect(doc).toContain('production DB write');
  });

  it('records false side effects for the preflight', () => {
    expect(doc).toContain('"production_db_write": false');
    expect(doc).toContain('"migration_apply": false');
    expect(doc).toContain('"db_push": false');
    expect(doc).toContain('"migration_repair": false');
    expect(doc).toContain('"sql_replay": false');
    expect(doc).toContain('"rls_or_grant_executed": false');
  });
});
