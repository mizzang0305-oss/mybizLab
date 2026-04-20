import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SetupRequestInput } from '@/shared/types/models';

const { findStoreBySlug, getCanonicalStorePublicPageBySlug, from, insert, updateDatabase } = vi.hoisted(() => ({
  findStoreBySlug: vi.fn(),
  getCanonicalStorePublicPageBySlug: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn((payload: unknown) => insert(payload)),
  })),
  updateDatabase: vi.fn(() => {
    throw new Error('updateDatabase should not be called in live runtime');
  }),
}));

vi.mock('@/shared/lib/appConfig', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/appConfig')>('@/shared/lib/appConfig');
  return {
    ...actual,
    DATA_PROVIDER: 'supabase',
    IS_DEMO_RUNTIME: false,
    IS_PRODUCTION_RUNTIME: true,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from,
  },
}));

vi.mock('@/shared/lib/repositories', () => ({
  getCanonicalMyBizRepository: () => ({
    findStoreBySlug,
  }),
}));

vi.mock('@/shared/lib/services/publicPageService', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/services/publicPageService')>(
    '@/shared/lib/services/publicPageService',
  );

  return {
    ...actual,
    getCanonicalStorePublicPageBySlug,
  };
});

vi.mock('@/shared/lib/mockDb', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/mockDb')>('@/shared/lib/mockDb');
  return {
    ...actual,
    getDatabase: vi.fn(() => {
      throw new Error('getDatabase should not be called in live runtime');
    }),
    updateDatabase,
  };
});

import { saveSetupRequest } from '@/shared/lib/services/mvpService';

const requestInput: SetupRequestInput = {
  business_name: 'Live Request Store',
  owner_name: '홍길동',
  business_number: '123-45-67890',
  phone: '010-1234-5678',
  email: 'owner@live-request.kr',
  address: '서울 성수동 123-45',
  business_type: 'Cafe',
  requested_slug: 'live-request-store',
  selected_features: ['ai_manager', 'sales_analysis'],
};

describe('saveSetupRequest in live runtime', () => {
  beforeEach(() => {
    findStoreBySlug.mockReset();
    getCanonicalStorePublicPageBySlug.mockReset();
    from.mockClear();
    insert.mockReset();
    updateDatabase.mockClear();

    findStoreBySlug.mockResolvedValue(null);
    getCanonicalStorePublicPageBySlug.mockResolvedValue(null);
    insert.mockResolvedValue({ error: null });
  });

  it('stores the request through Supabase without touching the mock database', async () => {
    const savedRequest = await saveSetupRequest(requestInput, { requestedPlan: 'pro' });
    const persistedPayload = insert.mock.calls[0]?.[0];

    expect(findStoreBySlug).toHaveBeenCalledWith('live-request-store');
    expect(getCanonicalStorePublicPageBySlug).toHaveBeenCalledWith('live-request-store');
    expect(from).toHaveBeenCalledWith('store_setup_requests');
    expect(persistedPayload).toMatchObject({
      business_name: 'Live Request Store',
      business_number: '123-45-67890',
      requested_slug: 'live-request-store',
      selected_features: ['ai_manager', 'sales_analysis'],
      status: 'submitted',
    });
    expect(persistedPayload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(persistedPayload).not.toHaveProperty('brand_name');
    expect(persistedPayload).not.toHaveProperty('requested_plan');
    expect(persistedPayload).not.toHaveProperty('tagline');
    expect(updateDatabase).not.toHaveBeenCalled();
    expect(savedRequest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(savedRequest.requested_plan).toBe('pro');
    expect(savedRequest.requested_slug).toBe('live-request-store');
  });

  it('surfaces the live Supabase insert error without falling back to mock data', async () => {
    insert.mockResolvedValue({
      error: {
        message: 'permission denied for table store_setup_requests',
      },
    });

    await expect(saveSetupRequest(requestInput, { requestedPlan: 'pro' })).rejects.toThrow(
      '스토어 생성 요청을 저장하지 못했습니다: permission denied for table store_setup_requests',
    );

    expect(updateDatabase).not.toHaveBeenCalled();
  });
});
