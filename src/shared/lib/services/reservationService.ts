import { createId } from '@/shared/lib/ids';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import { assertStoreEntitlement } from '@/shared/lib/services/storeEntitlementsService';
import type { Reservation, ReservationStatus } from '@/shared/types/models';

function nowIso() {
  return new Date().toISOString();
}

export async function listStoreReservations(storeId: string) {
  await assertStoreEntitlement(storeId, 'reservations');
  const repository = getCanonicalMyBizRepository();
  const reservations = await repository.listReservations(storeId);

  return reservations
    .slice()
    .sort((left, right) => left.reserved_at.localeCompare(right.reserved_at));
}

export async function saveStoreReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
) {
  await assertStoreEntitlement(storeId, 'reservations');
  const repository = getCanonicalMyBizRepository();
  const timestamp = nowIso();
  const existing = input.id ? (await repository.listReservations(storeId)).find((reservation) => reservation.id === input.id) || null : null;

  const memory = await upsertCustomerMemory({
    customerId: existing?.customer_id,
    eventType: existing ? 'reservation_updated' : 'reservation_captured',
    metadata: {
      partySize: input.party_size,
      reservedAt: input.reserved_at,
      status: input.status,
    },
    name: input.customer_name,
    occurredAt: input.reserved_at,
    phone: input.phone,
    source: 'reservation',
    storeId,
    summary: existing ? '예약 정보가 업데이트되었습니다.' : '예약이 고객 메모리에 연결되었습니다.',
  });

  const reservation: Reservation = {
    ...existing,
    ...input,
    id: input.id || createId('reservation'),
    store_id: storeId,
    customer_id: memory.customer.id,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
  };

  return repository.saveReservation(reservation);
}

export async function updateStoreReservationStatus(storeId: string, reservationId: string, status: ReservationStatus) {
  const repository = getCanonicalMyBizRepository();
  const current = (await repository.listReservations(storeId)).find((reservation) => reservation.id === reservationId) || null;
  if (!current) {
    throw new Error('Reservation could not be found for this store.');
  }

  return saveStoreReservation(storeId, {
    ...current,
    status,
  });
}
