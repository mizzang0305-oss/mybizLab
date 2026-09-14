import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
const alignment = read('supabase/migration_drafts/20260914091951_mybiz_service_os_stage2_identity_policy_alignment.sql');
const rollback = read('supabase/tests/fixtures/mybiz_service_os_stage2_identity_policy_alignment_down.sql');
const pgTap = read('supabase/tests/mybiz_service_os_stage2_identity_policy_alignment_rls.sql');

describe('MyBiz Stage 2 Identity Policy Alignment', () => {
  it('guards precisely against rerun or drift instead of substring matching', () => {
    expect(alignment).not.toContain("like '%is_store_member%'");
    expect(alignment).toContain('STAGE2_IDENTITY_POLICY_ALIGNMENT_EXACT_OLD_STATE_REQUIRED');
    expect(alignment).toContain('v_old_policy_count <> 9');
    expect(alignment).toContain('v_new_policy_count <> 0');
    expect(alignment).toContain("p.roles = array['authenticated']::name[]");
    expect(alignment).toContain("regexp_replace(coalesce(p.qual, ''), '[[:space:]()]', '', 'g')");
  });

  it('replaces only the nine authorized SELECT policies with the Service OS resolver', () => {
    expect(alignment.match(/^drop policy .*_member_select/mg)).toHaveLength(9);
    expect(alignment.match(/^create policy .*_member_select/mg)).toHaveLength(9);
    expect(alignment.match(/private\.is_service_os_store_member\(store_id\)/g)).toHaveLength(9);
    expect(alignment).not.toContain('vertical_templates_public_v1_select');
    expect(alignment).not.toContain('job_confirmation_links');
    expect(alignment).not.toMatch(/create or replace function|grant |insert into|update |delete from/i);
  });

  it('has a policy-only rollback that restores all nine old predicates', () => {
    expect(rollback).toContain('STAGE2_IDENTITY_POLICY_ALIGNMENT_EXACT_NEW_STATE_REQUIRED');
    expect(rollback.match(/^drop policy .*_member_select/mg)).toHaveLength(9);
    expect(rollback.match(/^create policy .*_member_select/mg)).toHaveLength(9);
    expect(rollback.match(/public\.is_store_member\(store_id\)/g)).toHaveLength(9);
    expect(rollback).not.toMatch(/profile_auth_bindings|drop function|drop schema|grant |revoke /i);
  });

  it('covers exact-bound, wrong-store, non-member, legacy-unbound, and revoked access', () => {
    expect(pgTap).toContain('select extensions.plan(24)');
    for (const name of [
      'EXACT_BOUND_CORRECT_STORE_ALLOW',
      'EXACT_BOUND_WRONG_STORE_DENY',
      'NON_MEMBER_DENY',
      'STAGE2_UNBOUND_LEGACY_STORE_DENY',
      'REVOKED_BINDING_STAGE2_DENY',
    ]) {
      expect(pgTap).toContain(name);
    }
    expect(pgTap).toContain('GLOBAL_DEPENDENCY_COUNT_THIRTY_THREE');
    expect(pgTap).toContain('STAGE2_WRITE_POLICY_COUNT_ZERO');
  });
});
