import { resetDatabase } from '@/shared/lib/mockDb';
import {
  getStoreBySlug,
  listCustomers,
  listOrders,
  listReservations,
  listSales,
  listWaitingEntries,
} from '@/shared/lib/services/mvpService';

describe('mvp seed data', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('provides a demo store slug with core operating data', async () => {
    const store = await getStoreBySlug('golden-coffee');

    expect(store?.slug).toBe('golden-coffee');
    expect(store?.brand_color).toBe('#ec5b13');
  });

  it('hydrates core app datasets so pages do not render empty', async () => {
    const store = await getStoreBySlug('golden-coffee');
    expect(store).not.toBeNull();

    const [orders, customers, reservations, waiting, sales] = await Promise.all([
      listOrders(store!.id),
      listCustomers(store!.id),
      listReservations(store!.id),
      listWaitingEntries(store!.id),
      listSales(store!.id),
    ]);

    expect(orders.length).toBeGreaterThan(0);
    expect(orders.some((order) => order.payment_status === 'paid')).toBe(true);
    expect(customers.length).toBeGreaterThan(0);
    expect(reservations.length).toBeGreaterThan(0);
    expect(waiting.length).toBeGreaterThan(0);
    expect(sales.sales.length).toBeGreaterThanOrEqual(7);
  });
});
