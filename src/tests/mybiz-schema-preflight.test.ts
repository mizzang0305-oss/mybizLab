import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVICE_OS_ACTIVATION,
  resolveServiceOsActivation,
} from '../domain/mybiz/serviceOsActivation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const foundation = read('supabase/migration_drafts/20260914005630_mybiz_service_os_foundation.sql');
const activation = read('supabase/migration_drafts/20260914005632_mybiz_service_os_live_write_activation.sql');
const legacyDraft = read('supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql');
const pgTap = read('supabase/tests/mybiz_service_os_foundation_rls.sql');
const workflow = read('.github/workflows/mybiz-service-os-schema-preflight.yml');
const metadata = read('supabase/tests/mybiz_service_os_production_metadata_read_only.sql');
const evidenceDoc = read('docs/mybiz/SERVICE_OS_PRODUCTION_SCHEMA_EVIDENCE.md');
const rollbackDoc = read('docs/mybiz/SERVICE_OS_PRODUCTION_ROLLBACK_PLAN.md');
const runbook = read('docs/mybiz/SERVICE_OS_PRODUCTION_APPLY_RUNBOOK.md');
const contractBoundary = read('docs/mybiz/SERVICE_OS_CONTRACT_MODULE_BOUNDARY.md');
const identityAlignment = read('docs/mybiz/AUTH_PROFILE_IDENTITY_ALIGNMENT.md');
const productionShape = read('supabase/tests/fixtures/mybiz_service_os_production_shape.sql');

describe('MyBiz Service OS foundation Production readiness R2', () => {
  it('preserves the certified draft and introduces separately gated candidates', () => {
    expect(legacyDraft).toContain('DRAFT ONLY');
    expect(foundation).toContain('DRAFT ONLY: MyBiz Service OS foundation candidate');
    expect(activation).toContain('DRAFT ONLY: MyBiz Service OS browser write activation candidate');
    expect(activation).toContain('This migration MUST NOT be applied with the foundation migration');
  });

  it('aligns foundation foreign keys to the Production-shaped identifiers', () => {
    expect(foundation).not.toContain('references public.stores(id)');
    expect(foundation).toContain('references public.stores(store_id)');
    expect(foundation).toContain('references public.customers(customer_id)');
    expect(foundation).not.toMatch(/references public\.contracts|contract_id/i);
    expect(foundation).toContain('references public.profiles(id)');
    expect(foundation).toContain('foreign key (job_id, store_id)');
    expect(foundation).toContain('foreign key (job_id, revision_number, store_id)');
    expect(foundation).toContain('SERVICE_OS_REQUIRED_FK_MISMATCH');
    expect(foundation).toContain('SERVICE_OS_RELATION_COLLISION_REQUIRES_MANUAL_COMPATIBILITY_REVIEW');
  });

  it('keeps browser writes closed until the separate identity-proven activation', () => {
    expect(foundation).toMatch(/revoke all privileges on table[\s\S]+from public, anon, authenticated;/);
    expect(foundation).not.toMatch(/grant insert on table[\s\S]+to authenticated/i);
    expect(foundation).not.toMatch(/create policy \w+_insert/i);
    expect(activation).toContain("c.confrelid = 'auth.users'::regclass");
    expect(activation).toContain('AUTH_UID_TO_PROFILE_ID_MAPPING_NOT_PROVEN');
    expect(activation).toContain('LIVE_WRITE_ACTIVATION_STATUS=BLOCKED_AUTH_IDENTITY_MODEL');
    expect(activation).not.toMatch(/public\.contracts|contract_id/i);
    expect(activation).toContain('created_by = (select auth.uid())');
    expect(activation).toContain('uploader_user_id = (select auth.uid())');
  });

  it('forces RLS and limits private privileges without a schema-wide revoke', () => {
    const tables = [
      'service_jobs',
      'job_evidence_assets',
      'job_evidence_revisions',
      'job_confirmations',
      'job_confirmation_links',
      'consent_records',
      'job_payment_requests',
      'content_candidates',
      'brand_sites',
      'brand_site_portfolio_items',
      'vertical_templates',
    ];
    for (const table of tables) {
      expect(foundation).toContain(`alter table public.${table} enable row level security`);
      expect(foundation).toContain(`alter table public.${table} force row level security`);
    }
    expect(foundation).not.toMatch(/revoke all on schema private/i);
    expect(foundation).toContain('revoke all on function private.consume_job_confirmation_link');
    expect(foundation).not.toMatch(/grant (usage|execute)[^;]+private[^;]+to (anon|authenticated)/i);
  });

  it('keeps publication, confirmation, payment, and evidence boundaries fail closed', () => {
    expect(foundation).toContain("j.vertical <> 'medical'");
    expect(foundation).toContain('cr.withdrawn_at is null');
    expect(foundation).toContain('p_channel = any(cr.channels)');
    expect(foundation).toContain('p_merchant_approved_at is not null');
    expect(foundation).toContain('CONTENT_PROVIDER_RECEIPT_REQUIRED');
    expect(foundation).toContain("state = case when p_outcome = 'confirmed'");
    expect(foundation).not.toMatch(/set payment_state\s*=\s*'PAYMENT_PAID'/i);
    expect(foundation).not.toMatch(/grant (update|delete)[^;]+job_evidence_assets[^;]+authenticated/i);
  });

  it('runs a synchronized 59-case pgTAP matrix twice with a contention check', () => {
    const assertions = pgTap.match(/select extensions\.(?:lives_ok|throws_ok|results_eq)\(/g) ?? [];
    expect(assertions).toHaveLength(59);
    expect(pgTap).toContain('select extensions.plan(59)');
    expect(workflow.match(/supabase test db --local/g)).toHaveLength(2);
    expect(workflow.match(/mybiz_service_os_foundation_revision_atomicity\.sh/g)).toHaveLength(2);
    expect(workflow).toContain('FAILED_TRANSACTION_PARTIAL_OBJECTS=0');
    expect(workflow).toContain('PRE_WRITE_ROLLBACK_READY=PASS');
  });

  it('matches the verified Production shape without a contracts relation or profile-auth FK', () => {
    expect(productionShape).not.toMatch(/create table public\.contracts/i);
    expect(productionShape).not.toMatch(/profiles[\s\S]+references auth\.users/i);
    expect(pgTap).toContain('FOUNDATION_CONTRACT_RELATION_NOT_REQUIRED');
    expect(pgTap).toContain('FOUNDATION_CONTRACT_ID_COLUMN_ABSENT');
    expect(pgTap).toContain('PROFILE_AUTH_FK_ABSENT_LIVE_SHAPE');
    expect(pgTap).toContain('UNMAPPED_AUTH_CANNOT_ASSUME_PROFILE_MEMBERSHIP');
  });

  it('documents the deferred contract module and blocked auth activation', () => {
    expect(contractBoundary).toContain('FOUNDATION_CONTRACT_FK=false');
    expect(contractBoundary).toContain('CONTRACT_MODULE_BINDING=DEFERRED');
    expect(identityAlignment).toContain('PROFILE_AUTH_EQUALITY_UNIVERSAL=false');
    expect(identityAlignment).toContain('LIVE_WRITE_ACTIVATION_READY=false');
  });

  it('keeps the CI rehearsal ephemeral, pinned, and remote-free', () => {
    expect(workflow).toContain('runs-on: ubuntu-24.04');
    expect(workflow).toContain('version: 2.117.0');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('$RUNNER_TEMP/mybiz-service-os-preflight');
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toMatch(/SUPABASE_(ACCESS_TOKEN|DB_PASSWORD|PROJECT_ID):\s*\$\{\{/);
    expect(workflow).not.toMatch(/supabase (link|db push|migration (up|repair))/);
    expect(workflow).not.toMatch(/--linked|--project-ref|--db-url/);
  });

  it('provides the exact sanitized Production metadata binding and apply boundary', () => {
    expect(metadata).toContain('pg_catalog.pg_class');
    expect(metadata).toContain('information_schema.columns');
    expect(metadata).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b/i);
    expect(metadata).not.toContain('select *');
    expect(evidenceDoc).toContain('PROJECT_REF=plnuyudyogbzwpmdulnw');
    expect(evidenceDoc).toContain('POSTGRES_VERSION=17.6.1.063');
    expect(evidenceDoc).toContain('| `contracts` | ABSENT |');
    expect(evidenceDoc).toContain('profiles_without_matching_auth_user=1');
    expect(rollbackDoc).toContain('Window A');
    expect(rollbackDoc).toContain('Window B');
    expect(runbook).toContain('Foundation-only');
    expect(runbook).toContain('activation을 실행하지 않는다');
  });

  it('requires explicit evidence and keeps every runtime capability off by default', () => {
    expect(DEFAULT_SERVICE_OS_ACTIVATION).toEqual({
      schemaInstalled: false,
      liveWriteEnabled: false,
      confirmationEnabled: false,
      paymentEnabled: false,
      publicationEnabled: false,
    });
    expect(resolveServiceOsActivation({
      foundationSchemaCertified: true,
      browserWriteMigrationCertified: false,
      confirmationAdapterCertified: true,
      paymentAdapterCertified: true,
      publicationAdapterCertified: true,
    })).toEqual({
      schemaInstalled: true,
      liveWriteEnabled: false,
      confirmationEnabled: false,
      paymentEnabled: false,
      publicationEnabled: false,
    });
  });
});
