import { getCustomerRecordId } from '@/shared/lib/domain/customerMemory';
import { createId } from '@/shared/lib/ids';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import type { CanonicalMyBizRepository } from '@/shared/lib/repositories/contracts';
import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import { assertStoreEntitlement } from '@/shared/lib/services/storeEntitlementsService';
import type { Reservation, ReservationStatus } from '@/shared/types/models';

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

export async function listStoreReservations(storeId: string) {
  await assertStoreEntitlement(storeId, 'reservations');
  const repository = getCanonicalMyBizRepository();
  const reservations = await repository.listReservations(storeId);

  return reservations.slice().sort((left, right) => left.reserved_at.localeCompare(right.reserved_at));
}

export async function saveStoreReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
) {
  await assertStoreEntitlement(storeId, 'reservations');
  const repository = getCanonicalMyBizRepository();
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
    summary: existing ? '?덉빟 ?뺣낫媛 ?낅뜲?댄듃?섏뿀?듬땲??' : '?덉빟??怨좉컼 硫붾え由ъ뿉 ?곌껐?섏뿀?듬땲??',
  });
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
