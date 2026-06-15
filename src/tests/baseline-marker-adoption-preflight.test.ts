import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/baseline-marker-adoption-preflight.md');
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('baseline marker adoption preflight', () => {
  it('records the current active migration set and blocks marker-only adoption while a draft migration is active', () => {
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
    ]);

    expect(doc).toContain('Active migration count: `2`');
    expect(doc).toContain('`20260614_production_baseline_adoption.sql`');
    expect(doc).toContain('`20260615075421_customer_memory_schema_alignment.sql`');
    expect(doc).toContain('Adoption readiness: `BLOCKED_ACTIVE_MIGRATION_MISMATCH`');
  });

  it('documents remote migration history evidence without requiring production row samples', () => {
    expect(doc).toContain('Supabase CLI: `2.106.0`');
    expect(doc).toContain('Remote applied rows from `npx supabase migration list --linked`: `0`');
    expect(doc).toContain('Local-only rows from `npx supabase migration list --linked`: `2`');
    expect(doc).toContain('`supabase_migrations.schema_migrations` relation exists: `false`');
    expect(doc).toContain('No `SELECT *`, row samples, customer rows, lead rows, or raw PII were collected.');
  });

  it('keeps repair as a proposal only and does not include an executable version-specific command', () => {
    expect(doc).toContain('# PROPOSAL TEMPLATE ONLY. DO NOT RUN FROM THIS PR.');
    expect(doc).toContain('npx supabase migration repair <VERSION> --status applied --linked');
    expect(doc).toContain('Repair executed: `false`');

    expect(doc).not.toMatch(/npx supabase migration repair 20260614 --status applied --linked/);
    expect(doc).not.toMatch(/npx supabase migration repair --status applied 20260614 --linked/);
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
