import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
const foundation = read('supabase/migration_drafts/20260914091947_mybiz_service_os_auth_identity_foundation.sql');
const policyAlignment = read('supabase/migration_drafts/20260914091951_mybiz_service_os_stage2_identity_policy_alignment.sql');
const activationV1 = read('supabase/migration_drafts/20260914005632_mybiz_service_os_live_write_activation.sql');
const activationV2 = read('supabase/migration_drafts/20260914091955_mybiz_service_os_live_write_activation_v2.sql');
const fixture = read('supabase/tests/fixtures/mybiz_service_os_auth_identity_production_shape.sql');
const rollback = read('supabase/tests/fixtures/mybiz_service_os_auth_identity_down.sql');
const pgTap = read('supabase/tests/mybiz_service_os_auth_identity_rls.sql');
const workflow = read('.github/workflows/mybiz-service-os-auth-identity-readiness.yml');
const architecture = read('docs/mybiz/AUTH_IDENTITY_FOUNDATION_R1.md');
const evidence = read('docs/mybiz/AUTH_IDENTITY_PRODUCTION_EVIDENCE.md');
const bindingPolicy = read('docs/mybiz/LEGACY_PROFILE_BINDING_POLICY.md');
const runbook = read('docs/mybiz/AUTH_IDENTITY_APPLY_RUNBOOK.md');
const metadata = read('supabase/tests/mybiz_service_os_auth_identity_production_metadata_read_only.sql');

describe('MyBiz Service OS Auth Identity Foundation Readiness R1', () => {
  it('keeps every candidate draft-only and live writes blocked', () => {
    expect(foundation).toContain('DRAFT ONLY');
    expect(policyAlignment).toContain('DRAFT ONLY');
    expect(activationV2).toContain('DRAFT ONLY');
    expect(activationV1).toContain('LIVE_WRITE_ACTIVATION_STATUS=BLOCKED_AUTH_IDENTITY_MODEL');
    expect(activationV2).toContain('BLOCKED_AUTH_IDENTITY_FOUNDATION_NOT_APPLIED');
    expect(workflow).not.toContain('20260914091955_mybiz_service_os_live_write_activation_v2.sql');
  });

  it('creates a protected bridge with exact active one-to-one constraints', () => {
    expect(foundation).toContain('create table private.profile_auth_bindings');
    expect(foundation).toContain("references public.profiles(id) on delete restrict");
    expect(foundation).toContain("references core.profiles(id) on delete restrict");
    expect(foundation.match(/create unique index profile_auth_bindings_active_/g)).toHaveLength(2);
    expect(foundation).toContain('force row level security');
    expect(foundation).toContain('from public, anon, authenticated');
  });

  it('permits only reviewed sources and never performs heuristic matching', () => {
    for (const source of ['EXACT_ID', 'OWNER_VERIFIED', 'MIGRATION_VERIFIED', 'ADMIN_VERIFIED']) {
      expect(foundation).toContain(source);
    }
    expect(foundation).not.toMatch(/join[^;]+(?:email|phone|full_name)/i);
    expect(bindingPolicy).toContain('LEGACY_PROFILE_AUTO_BINDING=false');
  });

  it('backfills only an auth-core-public exact ID triple', () => {
    expect(foundation).toContain('join core.profiles cp on cp.id = p.id');
    expect(foundation).toContain('join auth.users au on au.id = cp.id');
    expect(foundation).toContain("'EXACT_ID'");
    expect(evidence).toContain('PUBLIC_PROFILE_EXACT_ID_MATCH_COUNT=2');
    expect(evidence).toContain('LEGACY_UNBOUND_MEMBERSHIPS=6');
  });

  it('uses auth.uid internally with hardened security-definer resolvers', () => {
    expect(foundation.match(/security definer/g)).toHaveLength(2);
    expect(foundation.match(/set search_path = ''/g)).toHaveLength(2);
    expect(foundation).toContain('select auth.uid() as id');
    expect(foundation).not.toMatch(/current_service_os_business_profile_id\s*\([^)]*(?:uuid|profile)/i);
    expect(foundation).toContain('grant execute on function private.current_service_os_business_profile_id() to authenticated');
  });

  it('allows only conflict-free exact fallback and makes revocation fail closed', () => {
    expect(foundation).toContain('exact_id_fallback');
    expect(foundation).toContain('where b.auth_profile_id = ci.id or b.public_profile_id = ci.id');
    expect(pgTap).toContain('REVOKED_BINDING_SUPPRESSES_EXACT_FALLBACK');
    expect(pgTap).toContain('OWNER_VERIFIED_CHOSEN_AUTH_GETS_SIX_MEMBERSHIPS');
  });

  it('aligns exactly nine Stage 2 reads while preserving the public template policy', () => {
    expect(policyAlignment.match(/create policy .*_member_select/g)).toHaveLength(9);
    expect(policyAlignment.match(/private\.is_service_os_store_member\(store_id\)/g)).toHaveLength(9);
    expect(policyAlignment).not.toContain('vertical_templates_public_v1_select');
    expect(pgTap).toContain('VERTICAL_TEMPLATE_POLICY_UNCHANGED');
  });

  it('does not replace the global membership function or rewrite unrelated policies', () => {
    expect(foundation).not.toMatch(/create or replace function public\.is_store_member/i);
    expect(policyAlignment).not.toMatch(/create or replace function public\.is_store_member/i);
    expect(architecture).toContain('기존 42개 dependency를 변경하지 않는다');
    expect(pgTap).toContain('GLOBAL_IS_STORE_MEMBER_SEMANTICS_UNCHANGED');
  });

  it('designs V2 writes around the resolved business actor without activating them', () => {
    expect(activationV2).toContain('created_by = private.current_service_os_business_profile_id()');
    expect(activationV2).toContain('uploader_user_id = private.current_service_os_business_profile_id()');
    expect(activationV2).not.toContain('created_by = (select auth.uid())');
    expect(runbook).toContain('live-write activation V1/V2 SQL을 실행하지 않는다');
  });

  it('models the sanitized 3/3/3/7 Production shape without contact data', () => {
    expect(fixture.match(/insert into auth\.users/g)).toHaveLength(1);
    expect(fixture.match(/'91000000-/g)).toHaveLength(6);
    expect(fixture.match(/'92000000-/g)).toHaveLength(7);
    expect(fixture).not.toContain('@');
    expect(fixture).not.toMatch(/phone|raw_app_meta_data|encrypted_password/i);
  });

  it('runs a synchronized 52-case pgTAP identity matrix', () => {
    const assertions = pgTap.match(/select extensions\.(?:has_table|results_eq|is_empty|throws_ok)\(/g) ?? [];
    expect(assertions).toHaveLength(52);
    expect(pgTap).toContain('select extensions.plan(52)');
    expect(pgTap).toContain('STORE_MEMBER_ROWS_REASSIGNED_ZERO');
    expect(pgTap).toContain('SERVICE_OS_WRITE_POLICIES_ZERO');
  });

  it('provides an Auth-only guarded rollback and remote-free pinned CI', () => {
    expect(rollback).not.toMatch(/drop schema private|drop table public\.service_jobs/i);
    expect(rollback).toContain('AUTH_IDENTITY_ROLLBACK_REQUIRES_EXACT_SEEDS_ONLY');
    expect(workflow).toContain('runs-on: ubuntu-24.04');
    expect(workflow).toContain('version: 2.117.0');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toMatch(/supabase (?:link|db push|migration (?:up|repair))/);
    expect(metadata).not.toMatch(/\b(?:insert|update|delete|alter|create|drop|truncate)\b/i);
    expect(metadata).not.toContain('select *');
  });
});
