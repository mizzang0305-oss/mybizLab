import { resetDatabase } from '@/shared/lib/mockDb';
import { attachCustomerToOrder, getPublicStore, listCustomers, listKitchenTickets, listSales, submitPublicOrder, updateKitchenTicketStatus } from '@/shared/lib/services/mvpService';

describe('store flow smoke test', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('runs slug-based QR order -> kitchen -> sales -> customer linkage flow', async () => {
    const publicStore = await getPublicStore('golden-coffee');
    expect(publicStore?.store.slug).toBe('golden-coffee');

    const firstItem = publicStore!.menu.items[0];
    const orderResult = await submitPublicOrder({
      storeSlug: 'golden-coffee',
      tableNo: 'A1',
      items: [{ menu_item_id: firstItem.id, quantity: 2 }],
      note: '테스트 주문',
    });

    expect(orderResult.order.table_no).toBe('A1');

    const customer = await attachCustomerToOrder(publicStore!.store.id, orderResult.order.id, {
      phone: '010-1111-1111',
      name: '김하나',
    });

    expect(customer?.id).toBe('customer_hana');

    await updateKitchenTicketStatus(publicStore!.store.id, orderResult.ticket.id, 'completed');

    const tickets = await listKitchenTickets(publicStore!.store.id);
    const updatedTicket = tickets.find((ticket) => ticket.id === orderResult.ticket.id);
    expect(updatedTicket?.status).toBe('completed');

    const sales = await listSales(publicStore!.store.id);
    expect(sales.totals.orderCount).toBeGreaterThan(3);

    const customers = await listCustomers(publicStore!.store.id);
    const hana = customers.find((entry) => entry.id === 'customer_hana');
    expect(hana?.visit_count).toBeGreaterThan(5);
  });
});
