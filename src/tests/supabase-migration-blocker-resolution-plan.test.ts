import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const plan = readFileSync(
  resolve(process.cwd(), 'docs/supabase-migration-blocker-resolution-plan.md'),
  'utf8',
);
const launchGates = readFileSync(resolve(process.cwd(), 'src/shared/lib/launchGates.ts'), 'utf8');

const blockers = [
  '20260405_mybiz_v2_phase1_phase2.sql',
  '20260406_mybiz_v2_phase3.sql',
  '20260424_public_store_text_backfill.sql',
  '20260511_review_abuse_guard.sql',
  '20260523_store_brand_theme_v2.sql',
] as const;

const recommendations = [
  'ARCHIVE_FROM_ACTIVE_MIGRATIONS',
  'CONTROLLED_IDEMPOTENT_APPLY_REQUIRED',
  'SAFE_TO_REPAIR_APPLIED',
  'KEEP_BLOCKED_NEEDS_EVIDENCE',
  'REPLACE_WITH_NEW_BASELINE',
] as const;

describe('Supabase migration blocker resolution plan', () => {
  it('covers all five blocker migrations and the duplicate 20260424 prefix', () => {
    for (const blocker of blockers) {
      expect(plan).toContain(`\`${blocker}\``);
      expect(plan).toContain(`### \`${blocker}\``);
    }

    expect(plan).toContain('Duplicate `20260424` Version-Prefix Resolution');
    expect(plan).toContain('`20260424_public_store_text_backfill.sql`');
    expect(plan).toContain('`20260424_store_subscriptions_canonical_alignment.sql`');
    expect(plan).toContain('ARCHIVE_OR_RENAME_BEFORE_REPAIR');
  });

  it('assigns a final recommendation to every blocker', () => {
    for (const blocker of blockers) {
      const escaped = blocker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rowPattern = new RegExp(
        '\\| `' + escaped + '` \\| `[^`]+` \\| `(' + recommendations.join('|') + ')` \\|',
      );

      expect(plan).toMatch(rowPattern);
    }
  });

  it('recommends production baseline adoption instead of full repair or mixed apply', () => {
    expect(plan).toContain('Overall strategy recommendation: `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED`');
    expect(plan).toContain('Recommended strategy: `PRODUCTION_BASELINE_ADOPTION_RECOMMENDED`');
    expect(plan).toContain('`FULL_SEQUENCE_REPAIR_AFTER_BLOCKERS_FIXED`: blocked');
    expect(plan).toContain('`MIXED_REPAIR_AND_CONTROLLED_APPLY_REQUIRED`: premature');
  });

  it('keeps repair and apply commands forbidden rather than executable', () => {
    expect(plan).toContain('does not approve or execute `npx supabase migration repair`');
    expect(plan).toContain('`npx supabase db push`');
    expect(plan).toContain('`npx supabase migration up`');
    expect(plan).toContain('SQL migration body replay');
    expect(plan).toContain('This PR intentionally does not include a concrete repair command');
    expect(plan).toContain('This PR intentionally does not include a concrete repair command, a concrete apply command');

    expect(plan).not.toMatch(/npx supabase migration repair --status applied 20\d{6}/);
    expect(plan).not.toMatch(/npx supabase db push --linked/);
    expect(plan).not.toMatch(/npx supabase migration up --linked/);
  });

  it('keeps live writes and production row changes blocked', () => {
    expect(plan).toContain('live lead write enablement');
    expect(plan).toContain('live customer memory write enablement');
    expect(plan).toContain('business table row creation/update/delete');
    expect(plan).toContain('customer or lead data creation');
    expect(plan).toContain('staging or committing `supabase/.temp/*`');

    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/leadCapturePersistenceEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);
  });
});
