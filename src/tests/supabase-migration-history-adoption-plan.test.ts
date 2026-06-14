import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const plan = readWorkspaceFile('docs/supabase-migration-history-full-adoption-plan.md');
const migrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const allowedClassifications = [
  'SAFE_TO_REPAIR_APPLIED',
  'NEEDS_SCHEMA_APPLY',
  'OBSOLETE_OR_DRAFT',
  'UNSAFE_DESTRUCTIVE',
  'UNKNOWN_NEEDS_EVIDENCE',
] as const;

describe('Supabase migration history full adoption plan', () => {
  it('covers every local migration file in the inventory', () => {
    expect(migrations).toHaveLength(15);
    expect(plan).toContain('Inventory count: `15` local migration files.');

    for (const migration of migrations) {
      const version = migration.split('_')[0];

      expect(plan).toContain(`\`${migration}\``);
      expect(plan).toContain(`\`${version}\``);
    }
  });

  it('assigns one allowed classification to every migration', () => {
    for (const migration of migrations) {
      const filenamePattern = migration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rowPattern = new RegExp(
        '\\| `' + filenamePattern + '` \\| `(' + allowedClassifications.join('|') + ')` \\|',
      );

      expect(plan).toMatch(rowPattern);
    }
  });

  it('keeps repair as a blocked proposal instead of an executable sequence', () => {
    expect(plan).toContain('Repair sequence status: `REPAIR_SEQUENCE_BLOCKED`');
    expect(plan).toContain('No concrete repair sequence is proposed in this PR.');
    expect(plan).toContain('# PROPOSAL TEMPLATE ONLY. DO NOT RUN FROM THIS PR.');
    expect(plan).toContain('npx supabase migration repair --status applied <VERSION> --linked');
    expect(plan).toContain('this PR does not run migration repair');

    expect(plan).not.toMatch(/npx supabase migration repair --status applied 20\d{6} --linked/);
    expect(plan).not.toMatch(/npx supabase migration repair 20\d{6} --status applied --linked/);
  });

  it('blocks migration apply, RLS, grants, live writes, and production data writes', () => {
    expect(plan).toContain('`npx supabase db push`');
    expect(plan).toContain('`npx supabase migration up`');
    expect(plan).toContain('SQL migration body replay');
    expect(plan).toContain('RLS policy apply');
    expect(plan).toContain('GRANT/REVOKE');
    expect(plan).toContain('live lead write enablement');
    expect(plan).toContain('live customer memory write enablement');
    expect(plan).toContain('customer or lead data creation');
    expect(plan).toContain('business table row creation/update/delete');
  });

  it('records target lead-capture evidence separately from the full-history decision', () => {
    expect(plan).toContain('## Target Migration: `20260609_lead_capture_requests.sql`');
    expect(plan).toContain('`lead_capture_requests` exists');
    expect(plan).toContain('`lead_capture_requests_row_count`: `0`');
    expect(plan).toContain('Required canonical columns missing: `0`');
    expect(plan).toContain('Required canonical columns nullable: `0`');
    expect(plan).toContain('Single-version repair: `BLOCKED_BY_FULL_HISTORY_DRIFT`');
  });

  it('keeps unrelated RLS advisories in a separate backlog', () => {
    expect(plan).toContain('## Out-of-Scope Security Backlog');
    expect(plan).toContain('unrelated RLS-disabled advisory');
    expect(plan).toContain('must not be mixed into migration-history repair');
    expect(plan).toContain('future RLS remediation needs its own approval');
  });
});
