import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import {
  attachCustomerToOrder,
  getPublicStore,
  getTableLiveBoard,
  listOrders,
  listSales,
  recordOrderPayment,
  submitPublicConsultation,
  submitPublicOrder,
  updateKitchenTicketStatus,
} from '@/shared/lib/services/mvpService';

describe('order payment branches and table live board', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('keeps order completion separate from payment completion and recognizes revenue only after payment is recorded', async () => {
    const publicStore = await getPublicStore('golden-coffee');
    if (!publicStore) {
      throw new Error('Expected seeded public store to exist.');
    }

    const firstItem = publicStore.menu.items[0];
    if (!firstItem) {
      throw new Error('Expected at least one seeded menu item.');
    }

    const salesBefore = await listSales(publicStore.store.id);
    const orderResult = await submitPublicOrder({
      storeSlug: 'golden-coffee',
      tableNo: 'A1',
      items: [{ menu_item_id: firstItem.id, quantity: 1 }],
      note: 'counter payment branch',
      paymentMethod: 'cash',
      paymentSource: 'counter',
    });

    expect(orderResult.order.payment_status).toBe('pending');
    expect(orderResult.order.payment_source).toBe('counter');

    await updateKitchenTicketStatus(publicStore.store.id, orderResult.ticket.id, 'completed');

    const completedOrder = (await listOrders(publicStore.store.id)).find((order) => order.id === orderResult.order.id);
    expect(completedOrder?.status).toBe('completed');
    expect(completedOrder?.payment_status).toBe('pending');

    const salesAfterCompletion = await listSales(publicStore.store.id);
    expect(salesAfterCompletion.totals.orderCount).toBe(salesBefore.totals.orderCount);

    await recordOrderPayment(publicStore.store.id, orderResult.order.id, {
      paymentMethod: 'cash',
      paymentSource: 'counter',
    });

    const paidOrder = (await listOrders(publicStore.store.id)).find((order) => order.id === orderResult.order.id);
    expect(paidOrder?.payment_status).toBe('paid');
    expect(paidOrder?.payment_method).toBe('cash');

    const salesAfterPayment = await listSales(publicStore.store.id);
    expect(salesAfterPayment.totals.orderCount).toBe(salesBefore.totals.orderCount + 1);
  });

  it('surfaces per-table customer memory and AI consultation context when an order is linked to a known customer', async () => {
    const publicStore = await getPublicStore('golden-coffee');
    if (!publicStore) {
      throw new Error('Expected seeded public store to exist.');
    }

    const firstItem = publicStore.menu.items[0];
    if (!firstItem) {
      throw new Error('Expected at least one seeded menu item.');
    }

    const consultation = await submitPublicConsultation({
      storeId: publicStore.store.id,
      customerName: '김하나',
      phone: '010-1111-1111',
      marketingOptIn: true,
      message: '오늘 저녁 2명 방문 예정인데 대기와 대표 메뉴를 먼저 알고 싶어요.',
    });

    const orderResult = await submitPublicOrder({
      storeSlug: 'golden-coffee',
      tableNo: 'A2',
      items: [{ menu_item_id: firstItem.id, quantity: 2 }],
      paymentMethod: 'card',
      paymentSource: 'mobile',
    });

    await attachCustomerToOrder(publicStore.store.id, orderResult.order.id, {
      phone: consultation.customer?.phone || '010-1111-1111',
      name: consultation.customer?.name || '김하나',
    });

    const board = await getTableLiveBoard(publicStore.store.id);
    const tableRow = board.find((row) => row.tableNo === 'A2');

    expect(tableRow?.pendingPaymentCount).toBeGreaterThan(0);
    expect(tableRow?.recentConversation?.channel).toBe('ai_chat');
    expect(tableRow?.recentTimeline.some((event) => event.event_type === 'conversation_message')).toBe(true);
    expect(tableRow?.tableOrders.some((order) => order.customer?.phone === '010-1111-1111')).toBe(true);
  });
});
