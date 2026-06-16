import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const doc = readWorkspaceFile('docs/customer-memory-rls-grant-hardening-plan.md');
const draftSql = readWorkspaceFile('supabase/migrations/20260616070824_customer_memory_rls_grant_hardening.sql');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');
const activeMigrations = readdirSync(workspacePath('supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('customer-memory RLS/grant hardening plan', () => {
  it('tracks the approved active migration set with the new hardening draft', () => {
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
    expect(doc).toContain('`20260614` | applied');
    expect(doc).toContain('`20260615075421` | applied');
    expect(doc).toContain('20260616070824_customer_memory_rls_grant_hardening.sql');
  });

  it('covers all target and related objects', () => {
    for (const tableName of [
      'customers',
      'customer_contacts',
      'inquiries',
      'customer_timeline_events',
      'stores',
      'store_members',
      'store_subscriptions',
      'profiles',
      'lead_capture_requests',
    ]) {
      expect(doc).toContain(`\`${tableName}\``);
    }

    expect(doc).toContain('`is_store_member`');
    expect(draftSql).toContain('public.is_store_member(uuid)');
  });

  it('documents anon, authenticated, service-role, and destructive privilege risks', () => {
    for (const riskText of [
      'Current anon/public risk',
      'Current authenticated risk',
      'Service role expectation',
      'DELETE/TRUNCATE/REFERENCES/TRIGGER exposure',
      'remove for `anon` and `authenticated`',
      'grant authenticated `SELECT`, `INSERT`, `UPDATE` only',
    ]) {
      expect(doc).toContain(riskText);
    }
  });

  it('proposes replacing public ALL policies with command-specific authenticated policies', () => {
    expect(doc).toContain('Current broad `public`/`ALL` policies are replaced');
    expect(doc).toContain('No DELETE policies are proposed for the MVP.');
    expect(draftSql).toMatch(/drop policy if exists customers_member_access/i);
    expect(draftSql).toMatch(/create policy customers_select_store_member/i);
    expect(draftSql).toMatch(/for select\s+to authenticated/i);
    expect(draftSql).toMatch(/create policy customer_contacts_insert_store_member/i);
    expect(draftSql).toMatch(/create policy inquiries_update_store_member/i);
    expect(draftSql).toMatch(/create policy customer_timeline_events_update_store_member/i);
  });

  it('includes the helper function exposure review and privilege minimization draft', () => {
    expect(doc).toContain('Helper function');
    expect(doc).toContain('revoking `EXECUTE` from `PUBLIC` and `anon`');
    expect(draftSql).toMatch(/revoke execute on function public\.is_store_member\(uuid\) from public, anon/i);
    expect(draftSql).toMatch(/grant execute on function public\.is_store_member\(uuid\) to authenticated, service_role/i);
  });

  it('keeps the SQL as proposal-only and records forbidden production operations', () => {
    expect(doc).toContain('Status: `PROPOSAL_ONLY_NOT_EXECUTED`');
    expect(doc).toContain('must not be applied from this PR');
    expect(draftSql).toContain('DRAFT ONLY');
    expect(draftSql).toContain('has NOT been applied to production');

    for (const forbidden of [
      'RLS policy apply',
      'GRANT/REVOKE',
      'npx supabase db push',
      'npx supabase migration up',
      'npx supabase migration repair',
      'SQL replay',
      'production DB write',
      'production schema change',
      'live customer-memory write',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('documents rollback and canary gates before launch', () => {
    expect(doc).toContain('## Rollback Plan');
    expect(doc).toContain('Rollback SQL draft is included');
    expect(draftSql).toContain('Rollback SQL draft');
    expect(doc).toContain('## Canary Prerequisite Checklist');
    expect(doc).toContain('Live customer-memory write canary is separately approved');
    expect(doc).toContain('## Launch Gate Criteria');
  });

  it('keeps live write gates disabled in source', () => {
    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveCustomerMemoryWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveAiTraceWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveBackgroundJobExecutionEnabled:\s*false/);
    expect(launchGates).toMatch(/livePublicPageEventWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/liveFeedbackRecordWriteEnabled:\s*false/);
    expect(doc).toContain('`liveCustomerMemoryWriteEnabled=false`');
  });

  it('records false side effects for this plan-only PR', () => {
    for (const sideEffect of [
      '"production_db_write": false',
      '"production_schema_changed": false',
      '"migration_apply": false',
      '"db_push": false',
      '"migration_repair": false',
      '"sql_replay": false',
      '"rls_or_grant_executed": false',
      '"live_customer_memory_write": false',
      '"live_lead_write": false',
      '"env_auth_payment_webhook_changed": false',
      '"raw_pii_output": false',
      '"sales_excel_import_touched": false',
      '"rls_grant_hardening_plan_created": true',
    ]) {
      expect(doc).toContain(sideEffect);
    }
  });
});
