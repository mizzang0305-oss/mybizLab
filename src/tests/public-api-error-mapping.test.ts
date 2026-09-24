import { describe, expect, it, vi } from 'vitest';

const publicApiDeps = vi.hoisted(() => ({
  createSupabaseRepository: vi.fn(() => ({
    getStorePublicPage: vi.fn().mockRejectedValue(
      new Error('Failed to load store: invalid input syntax for type uuid: "store_golden_coffee"'),
    ),
  })),
  getPublicConsultationSnapshot: vi.fn(),
  getSupabaseAdminClient: vi.fn(() => ({ mocked: true })),
}));

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: publicApiDeps.getSupabaseAdminClient,
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository: publicApiDeps.createSupabaseRepository,
}));

vi.mock('../shared/lib/services/consultationService.js', () => ({
  getPublicConsultationSnapshot: publicApiDeps.getPublicConsultationSnapshot,
  submitPublicConsultationMessage: vi.fn(),
}));

import { handlePublicConsultationFormRequest } from '../server/publicApi.js';

describe('public API error mapping', () => {
  it('returns 400 instead of 500 when a public consultation storeId is invalid for the live repository', async () => {
    const response = await handlePublicConsultationFormRequest(
      new Request('https://example.com/api/public/consultation-form?storeId=store_golden_coffee', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('invalid input syntax for type uuid'),
    });
  });
});
