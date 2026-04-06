import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import type { SetupRequestInput } from '@/shared/types/models';

type MaybeSingleResult = { data: unknown; error: null | { message: string } };

const { getUser, rpc, from, responseMap } = vi.hoisted(() => {
  const responseMap: Record<string, MaybeSingleResult> = {};

  function createQueryBuilder(table: string) {
    const builder = {
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        const result = responseMap[table];
        if (!result) {
          throw new Error(`No mocked maybeSingle result for ${table}`);
        }

        return result;
      }),
    };

    return builder;
  }

  return {
    getUser: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn((table: string) => ({
      select: vi.fn(() => createQueryBuilder(table)),
    })),
    responseMap,
  };
});

vi.mock('@/shared/lib/appConfig', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/appConfig')>('@/shared/lib/appConfig');
  return {
    ...actual,
    DATA_PROVIDER: 'supabase',
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser,
    },
    rpc,
    from,
  },
}));

import { createStoreFromSetupRequest } from '@/shared/lib/services/mvpService';

const requestInput: SetupRequestInput = {
  business_name: 'RPC Provision Store',
  owner_name: 'Live Owner',
  business_number: '123-45-67890',
  phone: '010-1234-5678',
  email: 'owner@rpc.kr',
  address: 'Seoul Seongsu 123-45',
  business_type: 'Cafe',
  requested_slug: 'rpc-provision-store',
  selected_features: ['ai_manager', 'sales_analysis', 'order_management'],
};

function setProvisioningRows(options?: { missing?: 'stores' | 'store_members' | 'store_analytics_profiles' | 'store_priority_settings' }) {
  responseMap.stores = {
    data:
      options?.missing === 'stores'
        ? null
        : {
            store_id: 'live-store-001',
            name: 'RPC Provision Store',
            timezone: 'Asia/Seoul',
            created_at: '2026-03-18T09:00:00.000Z',
            brand_config: {
              owner_name: 'Live Owner',
              business_number: '123-45-67890',
              phone: '010-1234-5678',
              email: 'owner@rpc.kr',
              address: 'Seoul Seongsu 123-45',
              business_type: 'Cafe',
            },
            slug: 'rpc-provision-store',
            trial_ends_at: null,
            plan: 'pro',
          },
    error: null,
  };
  responseMap.store_members = {
    data:
      options?.missing === 'store_members'
        ? null
        : {
            store_id: 'live-store-001',
            profile_id: 'user-live-owner',
            role: 'owner',
          },
    error: null,
  };
  responseMap.store_analytics_profiles = {
    data: options?.missing === 'store_analytics_profiles' ? null : { id: 'analytics-live', store_id: 'live-store-001' },
    error: null,
  };
  responseMap.store_priority_settings = {
    data:
      options?.missing === 'store_priority_settings'
        ? null
        : {
            id: 'priority-live',
            store_id: 'live-store-001',
            revenue_weight: 28,
            repeat_customer_weight: 18,
            reservation_weight: 16,
            consultation_weight: 14,
            branding_weight: 12,
            order_efficiency_weight: 12,
            created_at: '2026-03-18T09:00:00.000Z',
            updated_at: '2026-03-18T09:00:00.000Z',
            version: 1,
          },
    error: null,
  };
}

describe('createStoreFromSetupRequest with Supabase provisioning', () => {
  beforeEach(() => {
    resetDatabase();
    getUser.mockReset();
    rpc.mockReset();
    from.mockClear();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-live-owner',
        },
      },
      error: null,
    });
    rpc.mockResolvedValue({
      data: {
        store_id: 'live-store-001',
        slug: 'rpc-provision-store',
      },
      error: null,
    });
    setProvisioningRows();
  });

  it('creates the live store through create_store_with_owner and verifies canonical provisioning rows', async () => {
    const created = await createStoreFromSetupRequest(requestInput, {
      plan: 'pro',
      paymentId: 'payment_live_001',
      paymentMethodStatus: 'ready',
      requestStatus: 'approved',
      setupEventStatus: 'paid',
      setupStatus: 'setup_paid',
      subscriptionEventStatus: 'paid',
      subscriptionStatus: 'subscription_active',
    });

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith(
      'create_store_with_owner',
      expect.objectContaining({
        p_plan: 'pro',
        p_requested_slug: 'rpc-provision-store',
        p_store_name: 'RPC Provision Store',
      }),
    );

    expect(from).toHaveBeenCalledWith('stores');
    expect(from).toHaveBeenCalledWith('store_members');
    expect(from).toHaveBeenCalledWith('store_analytics_profiles');
    expect(from).toHaveBeenCalledWith('store_priority_settings');

    expect(created.store.id).toBe('live-store-001');
    expect(created.store.slug).toBe('rpc-provision-store');
    expect(created.publicUrl).toContain('/rpc-provision-store');

    const database = getDatabase();
    expect(database.store_public_pages.some((page) => page.store_id === 'live-store-001')).toBe(true);
  });

  it('throws if a required provisioning row is missing after RPC creation', async () => {
    setProvisioningRows({ missing: 'store_priority_settings' });

    await expect(
      createStoreFromSetupRequest(requestInput, {
        plan: 'pro',
      }),
    ).rejects.toThrow();
  });
});
