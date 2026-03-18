import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import type { SetupRequestInput } from '@/shared/types/models';

const { getUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

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
  },
}));

import { createStoreFromSetupRequest } from '@/shared/lib/services/mvpService';

const requestInput: SetupRequestInput = {
  business_name: 'RPC Provision Store',
  owner_name: '홍길동',
  business_number: '123-45-67890',
  phone: '010-1234-5678',
  email: 'owner@rpc.kr',
  address: '서울특별시 성동구 성수동1가 123-45',
  business_type: '카페',
  requested_slug: 'rpc-provision-store',
  selected_features: ['ai_manager', 'sales_analysis', 'order_management'],
};

describe('createStoreFromSetupRequest with Supabase provisioning', () => {
  beforeEach(() => {
    resetDatabase();
    getUser.mockReset();
    rpc.mockReset();
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
  });

  it('creates the live store through create_store_with_owner and mirrors the result locally', async () => {
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

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'create_store_with_owner',
      expect.objectContaining({
        p_store_name: 'RPC Provision Store',
        p_requested_slug: 'rpc-provision-store',
        p_plan: 'pro',
      }),
    );

    expect(created.store.id).toBe('live-store-001');
    expect(created.store.slug).toBe('rpc-provision-store');
    expect(created.publicUrl).toContain('/rpc-provision-store');

    const database = getDatabase();
    expect(database.stores.some((store) => store.id === 'live-store-001')).toBe(true);
    expect(database.store_members.some((member) => member.store_id === 'live-store-001' && member.role === 'owner')).toBe(true);
  });
});
