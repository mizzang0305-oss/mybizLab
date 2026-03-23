import { resetDatabase } from '@/shared/lib/mockDb';
import { getPublicStore, getPublicStoreById } from '@/shared/lib/services/mvpService';

describe('public store lookup', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('loads store data, notices, media, location, capabilities, and storefront highlights by slug', async () => {
    const store = await getPublicStore('golden-coffee');

    expect(store?.store.slug).toBe('golden-coffee');
    expect(store?.tables.some((table) => table.table_no === 'A1')).toBe(true);
    expect(store?.tables.some((table) => table.table_no === 'B1')).toBe(true);
    expect(store?.media.length).toBeGreaterThan(0);
    expect(store?.notices.length).toBeGreaterThan(0);
    expect(store?.location?.address).toContain('123-4');
    expect(store?.capabilities.consultationEnabled).toBe(true);
    expect(store?.capabilities.orderEntryEnabled).toBe(true);
    expect(store?.menuHighlights.today.length).toBeGreaterThan(0);
    expect(store?.menuHighlights.weekly.length).toBeGreaterThan(0);
    expect(store?.surveySummary?.responseCount).toBeGreaterThan(0);
    expect(store?.inquirySummary.totalCount).toBeGreaterThan(0);
  });

  it('loads the same public store by store id', async () => {
    const store = await getPublicStoreById('store_golden_coffee');

    expect(store?.store.slug).toBe('golden-coffee');
    expect(store?.experience.todayLabel.length).toBeGreaterThan(0);
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
