import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const cleanupDoc = readWorkspaceFile('docs/supabase-production-baseline-adoption-cleanup.md');
const manifest = readWorkspaceFile('supabase/migrations_archive/pre_baseline_20260614/MANIFEST.md');
const gitignore = readWorkspaceFile('.gitignore');

describe('Supabase production baseline adoption cleanup', () => {
  it('keeps legacy migrations archived while allowing reviewed post-baseline active migrations', () => {
    expect(activeMigrations).toEqual([
      '20260614132205_sales_excel_import_sync.sql',
      '20260614_production_baseline_adoption.sql',
    ]);

    const activeVersionPrefixes = activeMigrations.map((name) => name.split('_')[0]);
    expect(new Set(activeVersionPrefixes).size).toBe(activeVersionPrefixes.length);

    for (const migration of legacyMigrations) {
      expect(activeMigrations).not.toContain(migration);
    }
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
