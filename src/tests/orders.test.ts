import { buildOrderItems, calculateOrderTotal, upsertSalesDailyForCompletedOrder } from '@/shared/lib/domain/orders';

describe('order calculations', () => {
  it('calculates order totals from line items', () => {
    expect(
      calculateOrderTotal([
        { quantity: 2, unitPrice: 4500 },
        { quantity: 1, unitPrice: 7000 },
      ]),
    ).toBe(16000);
  });

  it('builds order item records with derived line totals', () => {
    const orderItems = buildOrderItems('order_1', 'store_1', [
      { menuItemId: 'menu_1', menuName: '아메리카노', quantity: 2, unitPrice: 4500 },
    ]);

    expect(orderItems[0].line_total).toBe(9000);
  });

  it('updates sales_daily when a completed order is applied', () => {
    const updated = upsertSalesDailyForCompletedOrder(
      [
        {
          id: 'sales_1',
          store_id: 'store_1',
          sale_date: '2026-03-13',
          order_count: 1,
          total_sales: 12000,
          average_order_value: 12000,
          channel_mix: { table: 1 },
        },
      ],
      {
        store_id: 'store_1',
        placed_at: '2026-03-13T10:00:00.000Z',
        total_amount: 8000,
        channel: 'table',
      },
    );

    expect(updated[0].order_count).toBe(2);
    expect(updated[0].total_sales).toBe(20000);
    expect(updated[0].average_order_value).toBe(10000);
  });
});
