import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SetupRequestInput } from '@/shared/types/models';

const { requestPublicApi } = vi.hoisted(() => ({
  requestPublicApi: vi.fn(),
}));

vi.mock('@/shared/lib/appConfig', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/appConfig')>('@/shared/lib/appConfig');
  return {
    ...actual,
    DATA_PROVIDER: 'mock',
    IS_DEMO_RUNTIME: true,
    IS_LIVE_RUNTIME: false,
    IS_PRODUCTION_RUNTIME: false,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: null,
}));

vi.mock('@/shared/lib/publicApiClient', () => ({
  requestPublicApi,
}));

vi.mock('@/shared/lib/mockDb', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/mockDb')>('@/shared/lib/mockDb');
  return {
    ...actual,
    getDatabase: vi.fn(actual.getDatabase),
    resetDatabase: vi.fn(actual.resetDatabase),
    updateDatabase: vi.fn(actual.updateDatabase),
  };
});

import { getDatabase, resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { saveSetupRequest } from '@/shared/lib/services/mvpService';

const requestInput: SetupRequestInput = {
  business_name: 'Demo Explicit Store',
  owner_name: 'Demo Owner',
  business_number: '123-45-67890',
  phone: '010-9876-5432',
  email: 'owner@demo-explicit.kr',
  address: 'Seoul Seongsu 456-78',
  business_type: 'Cafe',
  requested_slug: 'demo-explicit-store',
  selected_features: ['ai_manager', 'sales_analysis'],
};

describe('saveSetupRequest in explicit demo runtime', () => {
  beforeEach(() => {
    requestPublicApi.mockReset();
    vi.mocked(updateDatabase).mockClear();
    resetDatabase();
  });

  it('uses the demo persistence path only in explicit demo runtime', async () => {
    const savedRequest = await saveSetupRequest(requestInput, { requestedPlan: 'pro' });
    const database = getDatabase();
    const storedRequest = database.store_requests.find((request) => request.id === savedRequest.id);

    expect(requestPublicApi).not.toHaveBeenCalled();
    expect(updateDatabase).toHaveBeenCalledTimes(1);
    expect(storedRequest).toMatchObject({
      id: savedRequest.id,
      requested_plan: 'pro',
      requested_slug: 'demo-explicit-store',
      status: 'submitted',
    });
  });
});
