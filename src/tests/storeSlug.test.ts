import { buildStorePath, ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug, slugifyStoreName } from '@/shared/lib/storeSlug';

describe('store slug utilities', () => {
  it('normalizes store names into lowercase hyphenated slugs', () => {
    expect(slugifyStoreName('Golden Coffee Roasters')).toBe('golden-coffee-roasters');
    expect(normalizeStoreSlug('  Mint---BBQ  ')).toBe('mint-bbq');
  });

  it('removes unsupported characters and falls back when non-latin input disappears', () => {
    expect(normalizeStoreSlug('연수 noodle!!')).toBe('noodle');
    expect(normalizeStoreSlug('###')).toBe('store');
  });

  it('guards reserved words and duplicate suffixes', () => {
    expect(isReservedSlug('dashboard')).toBe(true);
    expect(isReservedSlug('pricing')).toBe(true);
    expect(isReservedSlug('terms')).toBe(true);
    expect(isReservedSlug('privacy')).toBe(true);
    expect(isReservedSlug('refund')).toBe(true);
    expect(ensureUniqueStoreSlug('dashboard', [])).toBe('dashboard-store');
    expect(ensureUniqueStoreSlug('golden-coffee', ['golden-coffee', 'golden-coffee-2'])).toBe('golden-coffee-3');
  });

  it('builds the development route path', () => {
    expect(buildStorePath('golden-coffee', 'order')).toBe('/golden-coffee/order');
  });
});
