import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';
import { createDisabledSupabaseLeadCaptureRepository } from '@/server/mybiz/repositories/disabledSupabaseLeadCaptureRepository';
import { createMockLeadCaptureRepository } from '@/server/mybiz/repositories/mockLeadCaptureRepository';

describe('lead capture repository boundary', () => {
  afterEach(() => {
    clearLaunchGateOverridesForTest();
  });

  it('lists sanitized mock leads and updates status only in mock state', async () => {
    const repository = createMockLeadCaptureRepository();
    const [lead] = await repository.listLeads();

    expect(lead.contactPhoneMasked).toContain('****');
    expect(lead.contactEmailMasked).toContain('***');

    const result = await repository.transitionLeadStatus(lead.leadId, 'pilot_candidate', {
      nextAction: '파일럿 후보로 표시',
      ownerNote: '상담 후 파일럿 제안',
    });

    expect(result).toMatchObject({
      code: 'MOCK_LEAD_STATUS_UPDATED',
      ok: true,
    });
    await expect(repository.getLead(lead.leadId)).resolves.toMatchObject({
      nextAction: '파일럿 후보로 표시',
      status: 'pilot_candidate',
    });
  });

  it('blocks the console when owner-reviewed lead capture is gated off', async () => {
    setLaunchGateOverridesForTest({
      ownerReviewedLeadCaptureEnabled: false,
    });

    const repository = createMockLeadCaptureRepository();

    await expect(repository.listLeads()).rejects.toThrow('OWNER_REVIEWED_LEAD_CAPTURE_DISABLED');
  });

  it('returns approval-required for live lead writes while broad DB write is off', async () => {
    const repository = createDisabledSupabaseLeadCaptureRepository();

    await expect(repository.writeLead()).resolves.toEqual({
      approvalRequired: true,
      code: 'LIVE_LEAD_WRITE_DISABLED',
      ok: false,
    });
  });

  it('keeps the disabled Supabase adapter free of write calls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/server/mybiz/repositories/disabledSupabaseLeadCaptureRepository.ts'),
      'utf8',
    );

    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.delete(');
  });
});
