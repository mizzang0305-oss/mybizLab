import { describe, expect, it, vi } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

describe('live store settings write boundary', () => {
  it('updates an existing store without submitting entitlement or insert fields', async () => {
    resetDatabase();
    const store = getDatabase().stores[0];
    const row = {
      store_id: store.store_id || store.id,
      name: store.name,
      slug: store.slug,
      timezone: store.timezone || 'Asia/Seoul',
      brand_config: {},
      trial_ends_at: store.trial_ends_at || null,
      plan: 'free',
      created_at: new Date().toISOString(),
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn((_payload: Record<string, unknown>) => ({ eq }));
    const upsert = vi.fn();
    const from = vi.fn(() => ({ update, upsert }));
    const repository = createSupabaseRepository({ from } as never);

    await repository.saveStore(store);

    expect(from).toHaveBeenCalledWith('stores');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toEqual({
      name: store.name,
      slug: store.slug,
      brand_config: expect.any(Object),
      timezone: store.timezone || null,
    });
    expect(eq).toHaveBeenCalledWith('store_id', row.store_id);
    expect(upsert).not.toHaveBeenCalled();
  });
});
