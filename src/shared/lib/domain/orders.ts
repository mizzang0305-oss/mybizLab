import type { Order, OrderChannel, OrderItem, SalesDaily } from '@/shared/types/models';
import { createId } from '@/shared/lib/ids';
import { startOfDayKey } from '@/shared/lib/format';

export interface OrderLineInput {
  menuItemId: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
}

export function calculateOrderTotal(items: Array<{ quantity: number; unitPrice: number }>) {
  return items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
}

export function buildOrderItems(orderId: string, storeId: string, items: OrderLineInput[]): OrderItem[] {
  return items.map((item) => ({
    id: createId('order_item'),
    order_id: orderId,
    store_id: storeId,
    menu_item_id: item.menuItemId,
    menu_name: item.menuName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.quantity * item.unitPrice,
  }));
}

export function upsertSalesDailyForCompletedOrder(
  salesDaily: SalesDaily[],
  order: Pick<Order, 'store_id' | 'placed_at' | 'total_amount' | 'channel'>,
) {
  const saleDate = startOfDayKey(order.placed_at);
  const match = salesDaily.find((entry) => entry.store_id === order.store_id && entry.sale_date === saleDate);

  if (!match) {
    const nextEntry: SalesDaily = {
      id: createId('sales_daily'),
      store_id: order.store_id,
      sale_date: saleDate,
      order_count: 1,
      total_sales: order.total_amount,
      average_order_value: order.total_amount,
      channel_mix: {
        [order.channel]: 1,
      },
    };

    return [...salesDaily, nextEntry];
  }

  const updatedOrderCount = match.order_count + 1;
  const updatedTotalSales = match.total_sales + order.total_amount;
  const updatedChannelMix: Partial<Record<OrderChannel, number>> = {
    ...match.channel_mix,
    [order.channel]: (match.channel_mix[order.channel] || 0) + 1,
  };

  const updatedMatch: SalesDaily = {
    ...match,
    order_count: updatedOrderCount,
    total_sales: updatedTotalSales,
    average_order_value: Math.round(updatedTotalSales / updatedOrderCount),
    channel_mix: updatedChannelMix,
  };

  return salesDaily.map((entry) => (entry.id === match.id ? updatedMatch : entry));
}
