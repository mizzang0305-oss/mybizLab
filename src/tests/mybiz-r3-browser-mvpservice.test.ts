import { afterEach, describe, expect, it, vi } from 'vitest';

// These tests execute the browser/live branches of the real service with a
// recording Data API client. RLS/JWT is covered by the separate local stack.
const STORE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type Row = Record<string, unknown>;
type Operation = { table: string; kind: 'select' | 'insert' | 'upsert'; filters: Array<[string, unknown]>; payload?: Row };

async function loadBrowserService() {
  vi.resetModules();
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:3000' } });

  const operations: Operation[] = [];
  const rows: Record<string, Row[]> = {
    stores: [{ store_id: STORE_ID, name: 'Synthetic Store', slug: 'synthetic-store', brand_config: {}, plan: 'free', timezone: 'Asia/Seoul', created_at: '2026-01-01T00:00:00Z' }],
    menu_categories: [{ category_id: 'category-1', store_id: STORE_ID, name: 'Synthetic Category' }],
    menu_items: [{ menu_id: 'menu-1', category_id: 'category-1', store_id: STORE_ID, name: 'Synthetic Item', price: 1000, is_active: true }],
    store_tables: [{ table_id: 'table-1', store_id: STORE_ID, table_no: 1, status: 'available' }],
    store_priority_settings: [{ id: 'priority-1', store_id: STORE_ID, revenue_weight: 25, repeat_customer_weight: 25, reservation_weight: 15, consultation_weight: 10, branding_weight: 15, order_efficiency_weight: 10, version: 1, created_at: '2026-01-01T00:00:00Z' }],
    orders: [], order_items: [], customers: [], customer_contacts: [], customer_timeline_events: [], payment_events: [],
  };

  function query(table: string, kind: Operation['kind'], payload?: Row) {
    const filters: Array<[string, unknown]> = [];
    let sortColumn: string | undefined;
    const execute = () => {
      operations.push({ table, kind, filters: [...filters], payload });
      if (!(table in rows)) throw new Error(`Unexpected table: ${table}`);
      if (kind === 'insert' && (
        (table === 'menu_categories' && 'sort_order' in (payload || {})) ||
        (table === 'menu_items' && 'description' in (payload || {})) ||
        (table === 'store_tables' && 'qr_value' in (payload || {}))
      )) return { data: null, error: { code: '42703', message: 'column does not exist' } };
      if (kind !== 'select') {
        const next = { ...payload };
        if (table === 'menu_categories') next.category_id ||= 'category-created';
        if (table === 'menu_items') next.menu_id ||= 'menu-created';
        if (table === 'store_tables') next.table_id ||= 'table-created';
        if (table === 'store_priority_settings') next.id ||= 'priority-created';
        if (kind === 'upsert') rows[table] = rows[table].filter((row) => row.store_id !== next.store_id);
        rows[table].push(next);
        return { data: next, error: null };
      }
      let result = rows[table].filter((row) => filters.every(([column, value]) => row[column] === value));
      if (sortColumn) result = [...result].sort((left, right) => String(left[sortColumn!]).localeCompare(String(right[sortColumn!])));
      return { data: result, error: null };
    };
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      in: (column: string, values: unknown[]) => { filters.push([column, values[0]]); return builder; },
      order: (column: string) => { sortColumn = column; return builder; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: Array.isArray(result.data) ? result.data[0] || null : result.data }; },
      single: async () => { const result = execute(); return { ...result, data: Array.isArray(result.data) ? result.data[0] || null : result.data }; },
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    return builder;
  }

  const supabase = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } }, error: null }) },
    from(table: string) {
      return {
        select: () => query(table, 'select'),
        insert: (payload: Row) => query(table, 'insert', payload),
        upsert: (payload: Row) => query(table, 'upsert', payload),
        update: () => { throw new Error(`Unexpected direct browser UPDATE: ${table}`); },
      };
    },
  };
  const config = await vi.importActual<typeof import('@/shared/lib/appConfig')>('@/shared/lib/appConfig');
  const repositories = await vi.importActual<typeof import('@/shared/lib/repositories/supabaseRepository')>('@/shared/lib/repositories/supabaseRepository');
  vi.doMock('@/shared/lib/appConfig', () => ({ ...config, DATA_PROVIDER: 'supabase', IS_DEMO_RUNTIME: false, IS_LIVE_RUNTIME: true, IS_PRODUCTION_RUNTIME: true }));
  vi.doMock('@/integrations/supabase/client', () => ({ supabase }));
  vi.doMock('@/shared/lib/repositories/index', () => ({ getCanonicalMyBizRepository: () => repositories.createSupabaseRepository(supabase as never) }));

  return { operations, rows, service: await import('@/shared/lib/services/mvpService') };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('@/shared/lib/appConfig');
  vi.doUnmock('@/integrations/supabase/client');
  vi.doUnmock('@/shared/lib/repositories/index');
});

describe('mvpService live browser Data API paths', () => {
  it('reads menu and tables for the requested store and uses legacy-shaped insert fallbacks', async () => {
    const { operations, service } = await loadBrowserService();
    const menu = await service.listMenu(STORE_ID);
    const tables = await service.listStoreTables(STORE_ID);
    const category = await service.createMenuCategory(STORE_ID, 'New Synthetic Category');
    const item = await service.createMenuItem(STORE_ID, { category_id: String(category.id), name: 'New Synthetic Item', price: 2000, description: '', is_popular: false });
    const table = await service.createStoreTable(STORE_ID, { table_no: '2', seats: 4 });

    expect(menu.categories).toHaveLength(1);
    expect(menu.items).toHaveLength(1);
    expect(tables).toHaveLength(1);
    expect(item.name).toBe('New Synthetic Item');
    expect(table.table_no).toBe('2');
    for (const name of ['menu_categories', 'menu_items', 'store_tables']) {
      expect(operations.some((operation) => operation.table === name && operation.kind === 'select' && operation.filters.some(([key, value]) => key === 'store_id' && value === STORE_ID))).toBe(true);
      expect(operations.filter((operation) => operation.table === name && operation.kind === 'insert')).toHaveLength(2);
    }
    expect(operations.filter((operation) => operation.kind === 'insert').every((operation) => operation.payload?.store_id === STORE_ID)).toBe(true);
  }, 15_000);

  it('uses store-scoped text priority settings read and upsert in live mode', async () => {
    const { operations, service } = await loadBrowserService();
    const weights = { revenue: 30, repeatCustomers: 20, reservations: 15, consultationConversion: 10, branding: 15, orderEfficiency: 10 };
    const updated = await service.updateStorePrioritySettings(STORE_ID, weights);
    expect(updated).not.toBeNull();
    expect(updated?.store_id).toBe(STORE_ID);
    expect(updated?.revenue_weight).toBe(30);
    expect(operations).toContainEqual(expect.objectContaining({ table: 'store_priority_settings', kind: 'upsert', payload: expect.objectContaining({ store_id: STORE_ID, revenue_weight: 30 }) }));
    expect(operations.some((operation) => operation.table === 'store_priority_settings' && operation.kind === 'select' && operation.filters.some(([key, value]) => key === 'store_id' && value === STORE_ID))).toBe(true);
  }, 15_000);

  it('keeps the live orders path read-only at the browser table boundary', async () => {
    const { operations, service } = await loadBrowserService();
    expect(await service.listOrders(STORE_ID)).toEqual([]);
    expect(operations.some((operation) => operation.table === 'orders' && operation.kind === 'select' && operation.filters.some(([key, value]) => key === 'store_id' && value === STORE_ID))).toBe(true);
    expect(operations.some((operation) => operation.table === 'orders' && operation.kind !== 'select')).toBe(false);
  }, 15_000);

  it('routes live order status mutation to the merchant API, never orders.update', async () => {
    const { operations, rows, service } = await loadBrowserService();
    rows.orders.push({ order_id: 'order-synthetic', store_id: STORE_ID, status: 'pending', total_amount: 1000, created_at: '2026-01-01T00:00:00Z' });
    const outbound = vi.fn(async (_url: unknown) => new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' }, status: 200,
    }));
    vi.stubGlobal('fetch', outbound);

    await service.updateOrderStatus(STORE_ID, 'order-synthetic', 'accepted');

    expect(outbound).toHaveBeenCalledOnce();
    expect(outbound.mock.calls[0]?.[0]).toBe('/api/merchant/order-event');
    expect(operations.filter((operation) => operation.table === 'orders').every((operation) => operation.kind === 'select')).toBe(true);
  }, 15_000);
});
