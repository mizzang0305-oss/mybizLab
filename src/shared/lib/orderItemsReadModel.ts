import type { Order, OrderItem } from '../types/models.js';
import { isCorruptedMenuLabel, repairOrderItemMenuName } from './menuText.js';

export const ORDER_ITEMS_EMPTY_MESSAGE = '주문 품목 정보가 아직 연결되지 않았습니다.';

export type OrderItemsReadSource = 'canonical' | 'raw_payload' | 'none';

export interface OrderItemsReadModel {
  emptyMessage?: string;
  items: OrderItem[];
  source: OrderItemsReadSource;
}

type OrderLike = Pick<Order, 'id' | 'store_id' | 'total_amount'> & {
  items?: unknown;
  line_items?: unknown;
  lineItems?: unknown;
  metadata?: unknown;
  order_id?: unknown;
  orderItems?: unknown;
  order_items?: unknown;
  orderLines?: unknown;
  order_lines?: unknown;
  payload?: unknown;
  raw?: unknown;
  raw_items?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuantity(value: unknown) {
  const parsed = normalizeNumber(value, 1);
  return Math.max(1, Math.round(parsed));
}

function normalizeMoney(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(normalizeNumber(value, fallback)));
}

function normalizeItemName(row: Record<string, unknown>) {
  const value = normalizeText(row.menu_name || row.item_name || row.name || row.title || row.product_name);
  return isCorruptedMenuLabel(value) ? '' : value;
}

function normalizeOrderItem(input: {
  fallbackIdPrefix: string;
  index: number;
  order: OrderLike;
  row: Record<string, unknown>;
}) {
  const menuName = normalizeItemName(input.row);
  if (!menuName) {
    return null;
  }

  const quantity = normalizeQuantity(input.row.quantity || input.row.qty);
  const unitPrice = normalizeMoney(input.row.unit_price || input.row.unitPrice || input.row.price);
  const lineTotal = normalizeMoney(
    input.row.line_total || input.row.lineTotal || input.row.total_price || input.row.totalPrice,
    unitPrice * quantity,
  );
  const orderId = normalizeText(input.row.order_id || input.row.order_id_text || input.row.source_order_key || input.order.id);
  const rowId = normalizeText(input.row.id || input.row.order_item_id);

  return repairOrderItemMenuName({
    id: rowId || `${input.fallbackIdPrefix}_${input.order.id}_${input.index + 1}`,
    line_total: lineTotal,
    menu_item_id:
      normalizeText(input.row.menu_item_id || input.row.menuItemId || input.row.menu_id || input.row.product_id) ||
      rowId ||
      `${input.fallbackIdPrefix}_menu_${input.index + 1}`,
    menu_name: menuName,
    order_id: orderId || input.order.id,
    quantity,
    store_id: normalizeText(input.row.store_id) || input.order.store_id,
    unit_price: unitPrice,
  });
}

function collectRawItemArrays(value: unknown): unknown[][] {
  const record = toRecord(value);
  const candidates = [
    record.items,
    record.line_items,
    record.lineItems,
    record.order_items,
    record.orderItems,
    record.order_lines,
    record.orderLines,
    record.raw_items,
  ];

  return candidates.filter((candidate): candidate is unknown[] => Array.isArray(candidate));
}

export function normalizeOrderItemsFromCanonical(order: OrderLike, rows: unknown[]) {
  return rows
    .map((item, index) =>
      normalizeOrderItem({
        fallbackIdPrefix: 'canonical_item',
        index,
        order,
        row: toRecord(item),
      }),
    )
    .filter((item): item is OrderItem => Boolean(item));
}

export function normalizeOrderItemsFromRaw(order: OrderLike) {
  const orderRecord = toRecord(order);
  const rawRecords = [orderRecord, orderRecord.raw, orderRecord.payload, orderRecord.metadata]
    .map((value) => toRecord(value))
    .filter((value) => Object.keys(value).length > 0);
  const rawItems = rawRecords.flatMap((record) => collectRawItemArrays(record));

  return rawItems
    .flatMap((items) => items)
    .map((item, index) =>
      normalizeOrderItem({
        fallbackIdPrefix: 'raw_item',
        index,
        order,
        row: toRecord(item),
      }),
    )
    .filter((item): item is OrderItem => Boolean(item));
}

export function getOrderLineItems(order: OrderLike, canonicalItems: OrderItem[] = []): OrderItemsReadModel {
  if (canonicalItems.length) {
    return {
      items: canonicalItems,
      source: 'canonical',
    };
  }

  const rawItems = normalizeOrderItemsFromRaw(order);
  if (rawItems.length) {
    return {
      items: rawItems,
      source: 'raw_payload',
    };
  }

  return {
    emptyMessage: ORDER_ITEMS_EMPTY_MESSAGE,
    items: [],
    source: 'none',
  };
}

export function getOrderItemSummary(items: OrderItem[]) {
  if (!items.length) {
    return ORDER_ITEMS_EMPTY_MESSAGE;
  }

  return items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ');
}
