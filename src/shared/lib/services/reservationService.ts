import { getCustomerRecordId } from '../domain/customerMemory.js';
import { createId } from '../ids.js';
import { getCanonicalMyBizRepository } from '../repositories/index.js';
import type { CanonicalMyBizRepository } from '../repositories/contracts';
import { upsertCustomerMemory } from './customerMemoryService.js';
import { assertStoreEntitlement } from './storeEntitlementsService.js';
import type { Reservation, ReservationStatus } from '../../types/models';

interface ReservationServiceOptions {
  repository?: CanonicalMyBizRepository;
}

function nowIso() {
  return new Date().toISOString();
}

async function syncReservationVisitorSession(
  repository: CanonicalMyBizRepository,
  reservation: Reservation,
  customerId: string,
  timestamp: string,
) {
  if (!reservation.visitor_session_id) {
    return;
  }

  const sessions = await repository.listVisitorSessions(reservation.store_id);
  const session = sessions.find((item) => item.id === reservation.visitor_session_id);

  if (!session) {
    return;
  }

  await repository.saveVisitorSession({
    ...session,
    customer_id: customerId || session.customer_id,
    last_seen_at: timestamp,
    reservation_id: reservation.id,
    updated_at: timestamp,
  });
}

export async function listStoreReservations(storeId: string, options?: ReservationServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  await assertStoreEntitlement(storeId, 'reservations', undefined, { repository });
  const reservations = await repository.listReservations(storeId);

  return reservations.slice().sort((left, right) => left.reserved_at.localeCompare(right.reserved_at));
}

export async function saveStoreReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
  options?: ReservationServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  await assertStoreEntitlement(storeId, 'reservations', undefined, { repository });
  const timestamp = nowIso();
  const existing = input.id
    ? (await repository.listReservations(storeId)).find((reservation) => reservation.id === input.id) || null
    : null;

  const memory = await upsertCustomerMemory({
    customerId: existing?.customer_id,
    eventType: existing ? 'reservation_updated' : 'reservation_captured',
    metadata: {
      partySize: input.party_size,
      reservedAt: input.reserved_at,
      status: input.status,
      visitorSessionId: input.visitor_session_id || existing?.visitor_session_id || null,
    },
    name: input.customer_name,
    occurredAt: input.reserved_at,
    phone: input.phone,
    source: 'reservation',
    storeId,
    summary: existing ? '예약 정보가 고객 메모리에서 업데이트되었습니다.' : '예약이 고객 메모리에 연결되었습니다.',
  }, { repository });
  const customerId = getCustomerRecordId(memory.customer);

  const reservation: Reservation = {
    ...existing,
    ...input,
    id: input.id || createId('reservation'),
    store_id: storeId,
    customer_id: customerId,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
  };

  const savedReservation = await repository.saveReservation(reservation);
  await syncReservationVisitorSession(repository, savedReservation, customerId, timestamp);
  return savedReservation;
}

export async function updateStoreReservationStatus(
  storeId: string,
  reservationId: string,
  status: ReservationStatus,
  options?: ReservationServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const current = (await repository.listReservations(storeId)).find((reservation) => reservation.id === reservationId) || null;
  if (!current) {
    throw new Error('Reservation could not be found for this store.');
  }

  return saveStoreReservation(
    storeId,
    {
      ...current,
      status,
    },
    { repository },
  );
}
