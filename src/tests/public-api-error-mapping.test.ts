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
    expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/i);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: 'Invalid request.' });
    expect(JSON.stringify(body)).not.toContain('store_golden_coffee');
    expect(JSON.stringify(body)).not.toContain('invalid input syntax');
  });

  it('does not return or log an unhandled upstream error', async () => {
    publicApiDeps.createSupabaseRepository.mockImplementationOnce(() => ({
      getStorePublicPage: vi.fn().mockRejectedValue(new Error('private_customer_marker')),
    }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await handlePublicConsultationFormRequest(
        new Request('https://example.com/api/public/consultation-form?storeId=synthetic_store'),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Request could not be completed.');
      expect(JSON.stringify(body)).not.toContain('private_customer_marker');
      expect(JSON.stringify(log.mock.calls)).not.toContain('private_customer_marker');
      expect(response.headers.get('x-correlation-id')).toBe(body.correlationId);
    } finally {
      log.mockRestore();
    }
  });
});
