import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertStoreEntitlementMock, upsertCustomerMemoryMock } = vi.hoisted(() => ({
  assertStoreEntitlementMock: vi.fn().mockResolvedValue(undefined),
  upsertCustomerMemoryMock: vi.fn().mockResolvedValue({
    customer: {
      id: 'customer_live_001',
      customer_id: 'customer_live_001',
      store_id: 'store_live_001',
      name: 'Live Customer',
      phone: '010-1111-2222',
      visit_count: 1,
      is_regular: false,
      marketing_opt_in: true,
      created_at: '2026-04-23T00:00:00.000Z',
    },
  }),
}));

vi.mock('@/shared/lib/services/storeEntitlementsService', () => ({
  assertStoreEntitlement: assertStoreEntitlementMock,
}));

vi.mock('@/shared/lib/services/customerMemoryService', () => ({
  upsertCustomerMemory: upsertCustomerMemoryMock,
}));

vi.mock('@/shared/lib/repositories/index.js', () => ({
  getCanonicalMyBizRepository: vi.fn(() => {
    throw new Error('Default repository path should not be used in this test.');
  }),
}));

import { listStoreReservations, saveStoreReservation } from '@/shared/lib/services/reservationService';
import { listStoreWaitingEntries, saveStoreWaitingEntry } from '@/shared/lib/services/waitingService';

describe('reservation and waiting entitlement repository forwarding', () => {
  beforeEach(() => {
    assertStoreEntitlementMock.mockClear();
    upsertCustomerMemoryMock.mockClear();
  });

  it('passes the provided repository into reservation entitlement checks', async () => {
    const repository = {
      listReservations: vi.fn().mockResolvedValue([]),
      listVisitorSessions: vi.fn().mockResolvedValue([]),
      saveReservation: vi.fn().mockImplementation(async (reservation) => reservation),
      saveVisitorSession: vi.fn(),
    };

    await listStoreReservations('store_live_001', { repository: repository as never });
    await saveStoreReservation(
      'store_live_001',
      {
        customer_name: 'Live Customer',
        phone: '010-1111-2222',
        party_size: 4,
        reserved_at: '2026-04-23T12:00:00.000Z',
        status: 'booked',
      },
      { repository: repository as never },
    );

    expect(assertStoreEntitlementMock).toHaveBeenNthCalledWith(
      1,
      'store_live_001',
      'reservations',
      undefined,
      expect.objectContaining({ repository }),
    );
    expect(assertStoreEntitlementMock).toHaveBeenNthCalledWith(
      2,
      'store_live_001',
      'reservations',
      undefined,
      expect.objectContaining({ repository }),
    );
    expect(upsertCustomerMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store_live_001',
        source: 'reservation',
        summary: '예약이 고객 메모리에 연결되었습니다.',
      }),
      expect.objectContaining({ repository }),
    );
  });

  it('passes the provided repository into waiting entitlement checks', async () => {
    const repository = {
      listWaitingEntries: vi.fn().mockResolvedValue([]),
      listVisitorSessions: vi.fn().mockResolvedValue([]),
      saveVisitorSession: vi.fn(),
      saveWaitingEntry: vi.fn().mockImplementation(async (entry) => entry),
    };

    await listStoreWaitingEntries('store_live_001', { repository: repository as never });
    await saveStoreWaitingEntry(
      'store_live_001',
      {
        customer_name: 'Live Customer',
        phone: '010-1111-2222',
        party_size: 2,
        quoted_wait_minutes: 15,
        status: 'waiting',
      },
      { repository: repository as never },
    );

    expect(assertStoreEntitlementMock).toHaveBeenNthCalledWith(
      1,
      'store_live_001',
      'waiting_board',
      undefined,
      expect.objectContaining({ repository }),
    );
    expect(assertStoreEntitlementMock).toHaveBeenNthCalledWith(
      2,
      'store_live_001',
      'waiting_board',
      undefined,
      expect.objectContaining({ repository }),
    );
    expect(upsertCustomerMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store_live_001',
        summary: '웨이팅 정보가 고객 메모리에 연결되었습니다.',
      }),
      expect.objectContaining({ repository }),
    );
  });
});
