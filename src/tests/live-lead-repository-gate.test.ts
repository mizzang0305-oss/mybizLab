import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';
import { createSupabaseLeadCaptureRepository } from '@/server/mybiz/repositories/supabaseLeadCaptureRepository';
import type { LeadCaptureWriteDraft, SupabaseLeadCaptureClient } from '@/server/mybiz/repositories/leadCaptureRepository';

const draft: LeadCaptureWriteDraft = {
  businessType: 'cafe',
  contactEmailMasked: 'o***r@example.com',
  contactPhoneMasked: '010-****-0000',
  dataReadiness: 'medium',
  desiredOutcome: 'increase repeat visits',
  mainConcern: 'missed inquiries',
  source: 'onboarding',
  storeName: 'Pilot Store',
};

describe('live lead Supabase repository gate', () => {
  afterEach(() => {
    clearLaunchGateOverridesForTest();
  });

  it('blocks live lead writes by default before any Supabase insert can run', async () => {
    const insert = vi.fn();
    const client: SupabaseLeadCaptureClient = {
      from: () => ({
        insert,
      }),
    } as unknown as SupabaseLeadCaptureClient;

    const repository = createSupabaseLeadCaptureRepository({ client });

    await expect(repository.writeLead(draft)).resolves.toMatchObject({
      approvalRequired: true,
      code: 'LIVE_LEAD_WRITE_DISABLED',
      gate: 'broadDbWriteEnabled',
      ok: false,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('requires the lead-specific persistence gates after broad DB write is approved', async () => {
    setLaunchGateOverridesForTest({
      broadDbWriteEnabled: true,
    });

    const repository = createSupabaseLeadCaptureRepository();

    await expect(repository.writeLead(draft)).resolves.toMatchObject({
      gate: 'leadCapturePersistenceEnabled',
    });

    setLaunchGateOverridesForTest({
      leadCapturePersistenceEnabled: true,
    });

    await expect(repository.writeLead(draft)).resolves.toMatchObject({
      gate: 'liveLeadWriteEnabled',
    });
  });

  it('requires an explicit Supabase client only after all write gates are enabled', async () => {
    const repository = createSupabaseLeadCaptureRepository({
      approval: {
        broadDbWriteEnabled: true,
        leadCapturePersistenceEnabled: true,
        liveLeadWriteEnabled: true,
      },
    });

    await expect(repository.writeLead(draft)).rejects.toThrow('SUPABASE_LEAD_CAPTURE_CLIENT_REQUIRED');
  });

  it('keeps the gate check before the insert call in source order', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/server/mybiz/repositories/supabaseLeadCaptureRepository.ts'),
      'utf8',
    );

    expect(source).toContain("from('lead_capture_requests')");
    expect(source).toContain('.insert(');
    expect(source.indexOf('resolveLeadCaptureWriteGate')).toBeLessThan(source.indexOf('.insert('));
  });
});
