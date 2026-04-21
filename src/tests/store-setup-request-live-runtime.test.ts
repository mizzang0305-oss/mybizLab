import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildStoreSetupRequestRecord } from '@/shared/lib/setupRequestPersistence';
import type { SetupRequestInput } from '@/shared/types/models';

const { requestPublicApi, updateDatabase } = vi.hoisted(() => ({
  requestPublicApi: vi.fn(),
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
    IS_LIVE_RUNTIME: true,
    IS_PRODUCTION_RUNTIME: true,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/shared/lib/publicApiClient', () => ({
  requestPublicApi,
}));

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
  const originalWindow = globalThis.window;

  beforeEach(() => {
    requestPublicApi.mockReset();
    updateDatabase.mockClear();

    vi.stubGlobal(
      'window',
      {
        location: {
          origin: 'https://example.com',
        },
      } as Window & typeof globalThis,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow);
    }
  });

  it('submits the request through the onboarding server route without touching the mock database', async () => {
    const savedRequest = buildStoreSetupRequestRecord(requestInput, {
      requestedPlan: 'pro',
      requestedSlug: 'live-request-store',
    });
    requestPublicApi.mockResolvedValue({
      request: savedRequest,
    });

    const result = await saveSetupRequest(requestInput, { requestedPlan: 'pro' });

    expect(requestPublicApi).toHaveBeenCalledWith('/api/onboarding/setup-request', {
      method: 'POST',
      body: {
        input: {
          ...requestInput,
          requested_slug: 'live-request-store',
        },
        requestedPlan: 'pro',
      },
    });
    expect(updateDatabase).not.toHaveBeenCalled();
    expect(result.id).toBe(savedRequest.id);
    expect(result.requested_plan).toBe('pro');
    expect(result.requested_slug).toBe('live-request-store');
  });

  it('surfaces the live server save error without falling back to mock data', async () => {
    requestPublicApi.mockRejectedValue(new Error('동일한 이메일로 짧은 시간 안에 너무 많은 요청이 들어왔습니다. 잠시 후 다시 시도해 주세요.'));

    await expect(saveSetupRequest(requestInput, { requestedPlan: 'pro' })).rejects.toThrow(
      '동일한 이메일로 짧은 시간 안에 너무 많은 요청이 들어왔습니다. 잠시 후 다시 시도해 주세요.',
    );

    expect(updateDatabase).not.toHaveBeenCalled();
  });
});
