import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);

function readWorkspaceFile(path: string) {
  return readFileSync(workspacePath(path), 'utf8');
}

const legacyMigrations = [
  '20260405_mybiz_v2_phase1_phase2.sql',
  '20260406_mybiz_v2_phase3.sql',
  '20260422_orders_payment_fields.sql',
  '20260424_public_store_text_backfill.sql',
  '20260424_store_subscriptions_canonical_alignment.sql',
  '20260501_platform_admin_console.sql',
  '20260503_public_site_operating_system.sql',
  '20260509_store_content_engine_mvp.sql',
  '20260510_review_request_links.sql',
  '20260511_order_items_canonical.sql',
  '20260511_review_abuse_guard.sql',
  '20260511_review_public_safety_hardening.sql',
  '20260523_store_brand_theme_v2.sql',
  '20260603_store_oauth_credentials.sql',
  '20260609_lead_capture_requests.sql',
] as const;

const activeMigrationsPath = workspacePath('supabase/migrations');
const archivePath = workspacePath('supabase/migrations_archive/pre_baseline_20260614');
const activeMigrations = readdirSync(activeMigrationsPath)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const archivedMigrations = readdirSync(archivePath)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const marker = readWorkspaceFile('supabase/migrations/20260614_production_baseline_adoption.sql');
const alignmentDraft = readWorkspaceFile(
  'supabase/migrations_archive/post_baseline_20260928/20260615075421_customer_memory_schema_alignment.sql',
);
const hardeningDraft = readWorkspaceFile(
  'supabase/migrations_archive/post_baseline_20260928/20260616070824_customer_memory_rls_grant_hardening.sql',
);
const cleanupDoc = readWorkspaceFile('docs/supabase-production-baseline-adoption-cleanup.md');
const manifest = readWorkspaceFile('supabase/migrations_archive/pre_baseline_20260614/MANIFEST.md');
const gitignore = readWorkspaceFile('.gitignore');

describe('Supabase production baseline adoption cleanup', () => {
  it('preserves the provisioning HOLD outside the active migration scan', () => {
    const file = '20260928000000_mybiz_provisioning_hold.sql';
    const archived = readFileSync(
      workspacePath('supabase/migrations_archive/post_baseline_20260928', file),
    );
    const archiveManifest = readWorkspaceFile(
      'supabase/migrations_archive/post_baseline_20260928/MANIFEST.md',
    );

    expect(activeMigrations).not.toContain(file);
    // Git checkout may expand LF to CRLF on Windows; the committed SQL blob is LF.
    expect(createHash('sha256').update(archived.toString('utf8').replace(/\r\n/g, '\n')).digest('hex')).toBe(
      'ab4dd45e35f61bd809d39f43664092b5b8597f3767f1e84546a5291f867db5b5',
    );
    expect(archiveManifest).toContain('HISTORICAL_PRODUCTION_STATE_EVIDENCE');
    expect(archiveManifest).toContain('migration ledger: this version is **absent**');
  });

  it.each([
    ['20260615075421_customer_memory_schema_alignment.sql', '84f0028357ba5d521cb82b691ee37aac1c00e2b52eb5eeb413aed9defe789a28'],
    ['20260616070824_customer_memory_rls_grant_hardening.sql', '5f56ba21706387e9beb57565f6970879530ad09207087c54683e1b39e47d33d4'],
    ['20260927064807_mybiz_server_provisioning_boundary_20260927.sql', '81cbfb386f9d09858f3acac7e4b2f9849e41eb6712663035a0c81aa57af56c05'],
    ['20260927064932_mybiz_public_rls_compat_20260927.sql', '4011dad239954ec7f4e3f6c717500d54952cd6247762e53625cfefc0bb4638d3'],
  ])('archives already-applied SQL %s without changing its Git content', (file, expectedSha) => {
    const archived = readFileSync(workspacePath('supabase/migrations_archive/post_baseline_20260928', file));
    const archiveManifest = readWorkspaceFile('supabase/migrations_archive/post_baseline_20260928/MANIFEST.md');

    expect(activeMigrations).not.toContain(file);
    expect(createHash('sha256').update(archived.toString('utf8').replace(/\r\n/g, '\n')).digest('hex')).toBe(expectedSha);
    expect(archiveManifest).toContain(expectedSha);
    expect(archiveManifest).toContain('HISTORICAL_UNREPLAYABLE');
  });

  it('keeps the marker and the reviewed future identity resolver as the only active migrations', () => {
    expect(activeMigrations).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260928232001_service_os_verified_identity_resolver.sql',
    ]);

    const activeVersionPrefixes = activeMigrations.map((name) => name.split('_')[0]);
    expect(new Set(activeVersionPrefixes).size).toBe(activeVersionPrefixes.length);

    for (const migration of legacyMigrations) {
      expect(activeMigrations).not.toContain(migration);
    }
    const future = readWorkspaceFile('supabase/migrations/20260928232001_service_os_verified_identity_resolver.sql');
    expect(future).toContain('security definer');
    expect(future).toContain('security invoker');
    expect(future).toContain("set search_path = ''");
    expect(future).toMatch(/revoke all on function public\.resolve_service_os_business_profile_id\(uuid\)\s+from public, anon, authenticated;/i);
    expect(future).toMatch(/grant execute on function public\.resolve_service_os_business_profile_id\(uuid\)\s+to service_role;/i);
  });

  it('keeps the customer-memory alignment migration clearly draft-only and non-destructive', () => {
    expect(alignmentDraft).toContain('DRAFT ONLY');
    expect(alignmentDraft).toContain('Do not run `npx supabase db push`');
    expect(alignmentDraft).toContain('Do not run `npx supabase migration up`');
    expect(alignmentDraft).toContain('requires separate production approval');

    const executableSql = alignmentDraft
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
    expect(executableSql).not.toMatch(/\balter\s+table\b[^;]+enable\s+row\s+level\s+security/i);
  });

  it('keeps the customer-memory RLS/grant hardening migration clearly draft-only', () => {
    expect(hardeningDraft).toContain('DRAFT ONLY');
    expect(hardeningDraft).toContain('has NOT been applied to production');
    expect(hardeningDraft).toContain('Do not run this file without a separate owner approval');
    expect(hardeningDraft).toContain('revoke all privileges on table public.customers');
    expect(hardeningDraft).toContain('grant select, insert, update on table public.customers');
  });

  it('keeps the baseline marker comment-only and no-op', () => {
    const executableLines = marker
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('--'));

    expect(executableLines).toEqual([]);
    expect(marker).toContain('Production schema already exists');
    expect(marker).toContain('Legacy remote Supabase migration history was empty');
    expect(marker).toContain('Archived migrations must not be replayed on production');
    expect(marker).toContain('separate metadata adoption or repair approval');
    expect(marker).toContain('Future migrations should start after this production baseline marker');
  });

  it('preserves all 15 legacy migration files in the archive outside the active scan path', () => {
    expect(archivedMigrations).toEqual([...legacyMigrations].sort());
    expect(archivedMigrations).toHaveLength(15);

    for (const migration of legacyMigrations) {
      expect(existsSync(workspacePath('supabase/migrations_archive/pre_baseline_20260614', migration))).toBe(
        true,
      );
      expect(manifest).toContain(`supabase/migrations/${migration}`);
      expect(manifest).toContain(`supabase/migrations_archive/pre_baseline_20260614/${migration}`);
    }

    expect(relative(activeMigrationsPath, archivePath).startsWith('..')).toBe(true);
  });

  it('documents the cleanup decision, next approval gate, and rollback plan', () => {
    expect(cleanupDoc).toContain('PRODUCTION_BASELINE_ADOPTION_RECOMMENDED');
    expect(cleanupDoc).toContain('Archive count: `15` SQL files.');
    expect(cleanupDoc).toContain('No metadata command is proposed or executed by this PR.');
    expect(cleanupDoc).toContain('## Next Approval Step');
    expect(cleanupDoc).toContain('## Rollback Plan');
    expect(manifest).toContain('Rollback/source rollback plan');
  });

  it('keeps Supabase repair/apply/live write commands forbidden and temp files ignored', () => {
    for (const source of [cleanupDoc, manifest]) {
      expect(source).toContain('npx supabase migration repair');
      expect(source).toContain('npx supabase db push');
      expect(source).toContain('npx supabase migration up');
      expect(source).toContain('SQL migration body replay');
      expect(source).toContain('RLS policy apply');
      expect(source).toContain('GRANT/REVOKE');
      expect(source).toContain('live lead write');
      expect(source).toContain('live customer');
    }

    expect(gitignore).toMatch(/^supabase\/\.temp\/$/m);
    expect(cleanupDoc).toContain('The existing protected local `supabase/.temp/*` files are not staged');
  });
});
