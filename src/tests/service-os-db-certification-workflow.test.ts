import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const workflow = read('.github/workflows/mybiz-stage2-db-certification.yml');
const rlsTests = read('supabase/tests/mybiz_stage2_service_os_rls.sql');
const baseline = read('supabase/tests/fixtures/mybiz_stage2_ci_baseline.sql');

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
  });

  it('pins the CLI and stages the draft only inside the runner temp directory', () => {
    expect(workflow).toContain('version: 2.117.0');
    expect(workflow).toContain('$RUNNER_TEMP/mybiz-stage2-db');
    expect(workflow).toContain('supabase/migrations/*.sql');
    expect(workflow).toContain('supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql');
    expect(workflow).toContain('$CI_SUPABASE_ROOT/supabase/migrations/20260913083614_mybiz_stage2_service_os.sql');
    expect(workflow).toContain('supabase db reset --local');
    expect(workflow).toContain('supabase test db --local');
    expect(workflow).toContain('supabase db lint --local');
  });

  it('provides the required production-shaped baseline dependencies', () => {
    for (const table of ['profiles', 'stores', 'store_members', 'customers', 'customer_contacts', 'inquiries', 'customer_timeline_events', 'contracts']) {
      expect(baseline).toContain(`create table public.${table}`);
    }
    expect(baseline).toContain('create or replace function public.is_store_member');
    expect(baseline).toContain('references auth.users(id)');
    expect(baseline).toContain('CI-ONLY baseline fixture');
  });

  it('keeps the pgTAP plan synchronized with all required enforcement cases', () => {
    const assertions = rlsTests.match(/select extensions\.(?:lives_ok|throws_ok|results_eq)\(/g) ?? [];
    expect(assertions).toHaveLength(25);
    expect(rlsTests).toContain('select extensions.plan(25)');

    for (const scenario of [
      'CROSS_TENANT_SELECT_DENY',
      'CROSS_TENANT_INSERT_DENY',
      'CONTRACT_DRAFT_WORK_READY_DENY',
      'CONTRACT_SENT_WORK_READY_DENY',
      'PAYMENT_SELF_MARK_PAID_DENY',
      'CUSTOMER_CONFIRMATION_DIRECT_CLIENT_INSERT_DENY',
      'CONSENT_DIRECT_CLIENT_INSERT_DENY',
      'CONTENT_APPROVED_DIRECT_CLIENT_MUTATION_DENY',
      'BRAND_PUBLISHED_DIRECT_CLIENT_MUTATION_DENY',
      'MEDICAL_TEMPLATE_PUBLIC_DEFAULT_DENY',
      'CONFIRMATION_TOKEN_HASH_CLIENT_READ_DENY',
      'REVISION_ARBITRARY_INSERT_DENY',
      'REVISION_SKIP_DENY',
      'REVISION_CROSS_TENANT_DENY',
      'INVALID_REVISION_EVIDENCE_DENY',
      'MEMBER_JOB_INSERT_ALLOW',
      'NO_CONTRACT_WORK_READY_ALLOW',
      'CONTRACT_ACCEPTED_WORK_READY_ALLOW',
      'CONTRACT_SIGNED_WORK_READY_ALLOW',
      'MEMBER_HARDENED_EVIDENCE_INSERT_ALLOW',
      'MEMBER_OWN_DATA_SELECT_ALLOW',
      'SERVICE_ROLE_REVISION_BUMP_ALLOW',
      'SERVICE_ROLE_TERMINAL_MUTATION_ALLOW',
    ]) {
      expect(rlsTests).toContain(scenario);
    }
  });
});
