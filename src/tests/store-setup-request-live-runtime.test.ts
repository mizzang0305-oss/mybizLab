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

    expect(findStoreBySlug).toHaveBeenCalledWith('live-request-store');
    expect(getCanonicalStorePublicPageBySlug).toHaveBeenCalledWith('live-request-store');
    expect(from).toHaveBeenCalledWith('store_setup_requests');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requested_plan: 'pro',
        requested_slug: 'live-request-store',
      }),
    );
    expect(updateDatabase).not.toHaveBeenCalled();
    expect(savedRequest.requested_slug).toBe('live-request-store');
  });
});
