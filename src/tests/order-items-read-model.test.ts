import { describe, expect, it } from 'vitest';

import {
  getOrderItemSummary,
  getOrderLineItems,
  normalizeOrderItemsFromCanonical,
  ORDER_ITEMS_EMPTY_MESSAGE,
} from '@/shared/lib/orderItemsReadModel';
import type { Order } from '@/shared/types/models';

const baseOrder: Order = {
  id: 'order_001',
  store_id: 'store_001',
  channel: 'table',
  status: 'pending',
  payment_status: 'pending',
  total_amount: 9000,
  placed_at: '2026-05-11T09:00:00.000Z',
};

describe('order items canonical read model', () => {
  it('uses canonical order_items before raw payload compatibility items', () => {
    const model = getOrderLineItems(
      {
        ...baseOrder,
        raw: {
          items: [
            {
              item_name: 'Raw fallback item',
              quantity: 1,
              unit_price: 1000,
            },
          ],
        },
      },
      normalizeOrderItemsFromCanonical(baseOrder, [
        {
          id: 'canonical_item_001',
          order_id: 'order_001',
          store_id: 'store_001',
          item_name: 'Canonical latte',
          quantity: 2,
          unit_price: 4500,
          total_price: 9000,
        },
      ]),
    );

    expect(model.source).toBe('canonical');
    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      id: 'canonical_item_001',
      menu_name: 'Canonical latte',
      quantity: 2,
      line_total: 9000,
    });
  });

  it('falls back to raw payload items and filters corrupted item names', () => {
    const model = getOrderLineItems({
      ...baseOrder,
      raw: {
        items: [
          {
            item_name: '아메리카노',
            quantity: '2',
            unit_price: '4500',
          },
          {
            item_name: '????',
            quantity: 1,
            unit_price: 1000,
          },
        ],
      },
    });

    expect(model.source).toBe('raw_payload');
    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      menu_name: '아메리카노',
      quantity: 2,
      unit_price: 4500,
      line_total: 9000,
    });
  });

  it('returns a safe empty state when no item data is available', () => {
    const model = getOrderLineItems(baseOrder);

    expect(model.source).toBe('none');
    expect(model.items).toEqual([]);
    expect(model.emptyMessage).toBe(ORDER_ITEMS_EMPTY_MESSAGE);
    expect(getOrderItemSummary(model.items)).toBe(ORDER_ITEMS_EMPTY_MESSAGE);
  });
});
