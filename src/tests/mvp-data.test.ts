import { getDatabase, resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import {
  getStoreBySlug,
  listAccessibleStores,
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

  it('restores demo datasets and prioritizes a ready store for dashboard entry', async () => {
    updateDatabase((database) => {
      database.customers = [];
      database.orders = [];
      database.order_items = [];
      database.kitchen_tickets = [];
      database.reservations = [];
      database.waiting_entries = [];
      database.ai_reports = [];
      database.sales_daily = [];
    });

    const stores = await listAccessibleStores();

    expect(stores[0]?.slug).toBe('golden-coffee');

    const [goldenCustomers, mintOrders, mintReservations, mintSales] = await Promise.all([
      listCustomers('store_golden_coffee'),
      listOrders('store_mint_bbq'),
      listReservations('store_mint_bbq'),
      listSales('store_mint_bbq'),
    ]);

    expect(goldenCustomers.length).toBeGreaterThan(0);
    expect(mintOrders.length).toBeGreaterThan(0);
    expect(mintReservations.length).toBeGreaterThan(0);
    expect(mintSales.sales.length).toBeGreaterThan(0);
  });

  it('does not duplicate store feature rows during repeated bootstrap reads', async () => {
    await listAccessibleStores();
    await listAccessibleStores();

    const database = getDatabase();
    const featureKeys = database.store_features.map((feature) => `${feature.store_id}:${feature.feature_key}`);

    expect(new Set(featureKeys).size).toBe(database.store_features.length);
  });
});
