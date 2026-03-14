import { resetDatabase } from '@/shared/lib/mockDb';
import { getPublicStore } from '@/shared/lib/services/mvpService';

describe('public store lookup', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('loads store data by slug', async () => {
    const store = await getPublicStore('golden-coffee');

    expect(store?.store.slug).toBe('golden-coffee');
    expect(store?.tables.some((table) => table.table_no === 'A1')).toBe(true);
    expect(store?.tables.some((table) => table.table_no === 'B1')).toBe(true);
  });

  it('returns null for an invalid slug', async () => {
    const store = await getPublicStore('does-not-exist');

    expect(store).toBeNull();
  });

  it('blocks reserved slugs from resolving as public stores', async () => {
    const store = await getPublicStore('login');

    expect(store).toBeNull();
  });
});
