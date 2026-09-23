import { afterEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  requestPublicApi: vi.fn(),
}));

vi.mock('@/shared/lib/appConfig', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_DEMO_RUNTIME: false,
  IS_LIVE_RUNTIME: true,
}));
vi.mock('@/shared/lib/publicApiClient', () => ({ requestPublicApi: boundary.requestPublicApi }));

import { getPublicStore } from '@/shared/lib/services/mvpService';
import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

afterEach(() => {
  vi.unstubAllGlobals();
  boundary.requestPublicApi.mockReset();
});

describe('public-store least-privilege boundary', () => {
  it('does not fall through to browser Data API when the live public server route fails', async () => {
    vi.stubGlobal('window', {});
    boundary.requestPublicApi.mockRejectedValue(new Error('server snapshot unavailable'));

    await expect(getPublicStore('fixture-a')).rejects.toThrow('server snapshot unavailable');
  });

  it('does not read legacy store_home_content directly from a browser client', async () => {
    vi.stubGlobal('window', {});
    const calls: string[] = [];
    const store = {
      store_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Fixture A',
      timezone: 'Asia/Seoul',
      created_at: '2026-01-01T00:00:00.000Z',
      brand_config: {},
      slug: 'fixture-a',
      trial_ends_at: null,
      plan: 'free',
    };
    const client = {
      from(table: string) {
        calls.push(table);
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: table === 'stores' ? store : null, error: null };
          },
        };
        return builder;
      },
    };

    const repository = createSupabaseRepository(client as never);
    await expect(repository.getStorePublicPage(store.store_id)).resolves.toBeNull();
    expect(calls).not.toContain('store_home_content');
  });
});
