import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const workflow = read('.github/workflows/mybiz-stage2-db-certification.yml');
const rlsTests = read('supabase/tests/mybiz_stage2_service_os_rls.sql');
const baselinePath = 'supabase/baselines/current_production_schema_v1/current_schema_candidate_v4.sql';
const baseline = readFileSync(resolve(process.cwd(), baselinePath));
const oldFixture = read('supabase/tests/fixtures/mybiz_stage2_ci_baseline.sql');

describe('MyBiz Stage 2 database certification workflow', () => {
  it('uses an unprivileged pull_request workflow with no remote Supabase path', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).toMatch(/permissions:\s+contents: read/);
    expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).not.toMatch(/SUPABASE_ACCESS_TOKEN:\s*\$\{\{/);
    expect(workflow).not.toMatch(/SUPABASE_DB_PASSWORD:\s*\$\{\{/);
    expect(workflow).not.toMatch(/supabase (link|db push|migration (up|repair))/);
    expect(workflow).not.toMatch(/--linked|--project-ref/);
    expect(workflow).toContain('github.event.pull_request.number == 190');
    expect(workflow).toContain("github.head_ref == 'codex/mybiz-production-canonical-v1'");
  });

  it('pins the CLI and applies the current-state baseline to the isolated local database', () => {
    expect(workflow).toContain('version: 2.117.0');
    expect(workflow).toContain('$RUNNER_TEMP/mybiz-stage2-db');
    expect(workflow).toContain('supabase/baselines/current_production_schema_v1/current_schema_candidate_v4.sql');
    expect(workflow).toContain('psql -X -1 -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322');
    expect(workflow).not.toContain('cp supabase/migrations/*.sql');
    expect(workflow).not.toContain('cp supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql');
    expect(workflow).toContain('supabase db reset --local');
    expect(workflow).toContain('supabase test db --local');
    expect(workflow).toContain('supabase db lint --local');
    expect(workflow).toContain('DB_LINT_UNEXPECTED_FINDING');
    expect(workflow).toContain("findings[0].function === 'public.create_store_with_owner'");
    expect(workflow).toContain('test "$exposed_count" = 0');
  });

  it('uses the exact current-state baseline and retires the old synthetic fixture', () => {
    expect(createHash('sha256').update(baseline).digest('hex')).toBe(
      'e5009643f4d8341687ddc18818719505fff45cfe02257f179520225dff410646',
    );
    expect(oldFixture).toContain('OBSOLETE CI-ONLY synthetic fixture');
    expect(workflow).not.toContain('cp supabase/tests/fixtures/mybiz_stage2_ci_baseline.sql');
  });

  it('keeps the pgTAP plan synchronized with all required enforcement cases', () => {
    const assertions = rlsTests.match(/select extensions\.(?:lives_ok|throws_ok|results_eq|ok|is)\(/g) ?? [];
    expect(assertions).toHaveLength(48);
    expect(rlsTests).toContain('select extensions.plan(48)');

    for (const scenario of [
      'CROSS_TENANT_SELECT_DENY',
      'CROSS_TENANT_INSERT_DENY',
      'CONTRACT_DRAFT_DIRECT_INSERT_DENY',
      'CONTRACT_SENT_DIRECT_INSERT_DENY',
      'PAYMENT_SELF_MARK_PAID_DENY',
      'CONFIRMATION_DIRECT_CLIENT_INSERT_DENY',
      'CONSENT_DIRECT_CLIENT_INSERT_DENY',
      'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY',
      'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY',
      'MEDICAL_PUBLIC_DEFAULT_DENY',
      'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY',
      'REVISION_ARBITRARY_INSERT_DENY',
      'REVISION_SKIP_DENY',
      'REVISION_CROSS_TENANT_DENY',
      'INVALID_REVISION_EVIDENCE_DENY',
      'MEMBER_JOB_DIRECT_INSERT_DENY',
      'AUTHENTICATED_STAGE2_DIRECT_WRITE_GRANTS_ZERO',
      'SERVICE_ROLE_STAGE2_CRUD_GRANTS_11',
      'NO_CONTRACT_DIRECT_INSERT_DENY',
      'CONTRACT_ACCEPTED_DIRECT_INSERT_DENY',
      'CONTRACT_SIGNED_DIRECT_INSERT_DENY',
      'MEMBER_EVIDENCE_DIRECT_INSERT_DENY',
      'MEMBER_OWN_DATA_SELECT_ALLOW',
      'MEMBER_OWN_EVIDENCE_READ_ALLOW',
      'MEMBER_OWN_REVISION_READ_ALLOW',
      'MEMBER_JOB_DIRECT_UPDATE_DENY',
      'MEMBER_JOB_DIRECT_DELETE_DENY',
      'SERVICE_ROLE_JOB_INSERT_ALLOW',
      'SERVICE_ROLE_REVISION_BUMP_ALLOW',
      'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW',
      'CONFIRMATION_CONSUME_SERVER_ALLOW',
      'PUBLICATION_ELIGIBILITY_CONFIRMED_CONSENT_ALLOW',
    ]) {
      expect(rlsTests).toContain(scenario);
    }
    expect(rlsTests).not.toContain('MEMBER_JOB_INSERT_ALLOW');
  });
});
