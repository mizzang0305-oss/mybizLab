import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { saveReservation, saveWaitingEntry } from '@/shared/lib/services/mvpService';

describe('phase 3 canonical channel writes', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('links reservations to customer memory and appends timeline events', async () => {
    const reservation = await saveReservation('store_golden_coffee', {
      customer_name: 'Phase3 Reservation',
      note: 'window seat',
      party_size: 4,
      phone: '010-4444-8888',
      reserved_at: '2026-04-06T10:30:00.000Z',
      status: 'booked',
    });

    expect(reservation.customer_id).toBeTruthy();

    const database = getDatabase();
    const linkedCustomer = database.customers.find((customer) => customer.id === reservation.customer_id);

    expect(linkedCustomer?.phone).toBe('010-4444-8888');
    expect(
      database.customer_timeline_events.some(
        (event) =>
          event.store_id === 'store_golden_coffee' &&
          event.customer_id === reservation.customer_id &&
          event.event_type === 'reservation_captured',
      ),
    ).toBe(true);
  });

  it('links waiting entries to customer memory and appends timeline events', async () => {
    const waitingEntry = await saveWaitingEntry('store_golden_coffee', {
      customer_name: 'Phase3 Waiting',
      party_size: 2,
      phone: '010-5555-9999',
      quoted_wait_minutes: 20,
      status: 'waiting',
    });

    expect(waitingEntry.customer_id).toBeTruthy();

    const database = getDatabase();
    const linkedCustomer = database.customers.find((customer) => customer.id === waitingEntry.customer_id);

    expect(linkedCustomer?.phone).toBe('010-5555-9999');
    expect(
      database.customer_timeline_events.some(
        (event) =>
          event.store_id === 'store_golden_coffee' &&
          event.customer_id === waitingEntry.customer_id &&
          event.event_type === 'waitlist_captured',
      ),
    ).toBe(true);
  });

  it('syncs a linked visitor session after reservation capture', async () => {
    const database = getDatabase();
    const publicPageId = database.store_public_pages.find((page) => page.store_id === 'store_golden_coffee')?.id;

    const session = await touchVisitorSession({
      channel: 'home',
      path: '/s/store_golden_coffee',
      publicPageId,
      storeId: 'store_golden_coffee',
      visitorToken: 'reservation-visitor',
    });

    const reservation = await saveReservation('store_golden_coffee', {
      customer_name: 'Visitor Reservation',
      note: 'visitor linked',
      party_size: 3,
      phone: '010-1234-7777',
      reserved_at: '2026-04-06T11:00:00.000Z',
      status: 'booked',
      visitor_session_id: session.id,
    });

    const updatedSession = getDatabase().visitor_sessions.find((entry) => entry.id === session.id);

    expect(updatedSession).toMatchObject({
      customer_id: reservation.customer_id,
      reservation_id: reservation.id,
    });
  });

  it('syncs a linked visitor session after waiting capture', async () => {
    const database = getDatabase();
    const publicPageId = database.store_public_pages.find((page) => page.store_id === 'store_golden_coffee')?.id;

    const session = await touchVisitorSession({
      channel: 'home',
      path: '/s/store_golden_coffee',
      publicPageId,
      storeId: 'store_golden_coffee',
      visitorToken: 'waiting-visitor',
    });

    const waitingEntry = await saveWaitingEntry('store_golden_coffee', {
      customer_name: 'Visitor Waiting',
      party_size: 2,
      phone: '010-2222-7777',
      quoted_wait_minutes: 15,
      status: 'waiting',
      visitor_session_id: session.id,
    });

    const updatedSession = getDatabase().visitor_sessions.find((entry) => entry.id === session.id);

    expect(updatedSession).toMatchObject({
      customer_id: waitingEntry.customer_id,
      waiting_entry_id: waitingEntry.id,
    });
  });
});
