import { buildStorePath, ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug, slugifyStoreName } from '@/shared/lib/storeSlug';

describe('store slug utilities', () => {
  it('normalizes latin store names into lowercase hyphenated slugs', () => {
    expect(slugifyStoreName('Golden Coffee Roasters')).toBe('golden-coffee-roasters');
    expect(normalizeStoreSlug('  Mint---BBQ  ')).toBe('mint-bbq');
  });

  it('preserves meaningful Korean words instead of collapsing to store', () => {
    expect(normalizeStoreSlug('성수 브런치 하우스')).toBe('성수-브런치-하우스');
    expect(normalizeStoreSlug('연수 noodle!!')).toBe('연수-noodle');
    expect(normalizeStoreSlug('###')).toBe('store');
  });

  it('guards reserved words and duplicate suffixes', () => {
    expect(isReservedSlug('dashboard')).toBe(true);
    expect(isReservedSlug('pricing')).toBe(true);
    expect(isReservedSlug('terms')).toBe(true);
    expect(isReservedSlug('privacy')).toBe(true);
    expect(isReservedSlug('refund')).toBe(true);
    expect(ensureUniqueStoreSlug('dashboard', [])).toBe('dashboard-store');
    expect(ensureUniqueStoreSlug('성수 브런치 하우스', ['성수-브런치-하우스'])).toBe('성수-브런치-하우스-2');
  });

  it('builds the development route path', () => {
    expect(buildStorePath('golden-coffee', 'order')).toBe('/golden-coffee/order');
    expect(buildStorePath('성수-브런치-하우스', 'menu')).toBe('/성수-브런치-하우스/menu');
  });
});
