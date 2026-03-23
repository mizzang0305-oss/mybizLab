import {
  buildStoreIdPath,
  buildStorePath,
  ensureUniqueStoreSlug,
  isReservedSlug,
  normalizeStoreSlug,
  slugifyStoreName,
} from '@/shared/lib/storeSlug';

const seongsuHouse = '\uC131\uC218 \uBE0C\uB7F0\uCE58 \uD558\uC6B0\uC2A4';
const yeosuNoodle = '\uC5EC\uC218 noodle!!';

describe('store slug utilities', () => {
  it('normalizes latin store names into lowercase hyphenated slugs', () => {
    expect(slugifyStoreName('Golden Coffee Roasters')).toBe('golden-coffee-roasters');
    expect(normalizeStoreSlug('  Mint---BBQ  ')).toBe('mint-bbq');
  });

  it('preserves meaningful Korean words instead of collapsing to store', () => {
    expect(normalizeStoreSlug(seongsuHouse)).toBe('\uC131\uC218-\uBE0C\uB7F0\uCE58-\uD558\uC6B0\uC2A4');
    expect(normalizeStoreSlug(yeosuNoodle)).toBe('\uC5EC\uC218-noodle');
    expect(normalizeStoreSlug('###')).toBe('store');
  });

  it('guards reserved words and duplicate suffixes', () => {
    expect(isReservedSlug('dashboard')).toBe(true);
    expect(isReservedSlug('pricing')).toBe(true);
    expect(isReservedSlug('terms')).toBe(true);
    expect(isReservedSlug('privacy')).toBe(true);
    expect(isReservedSlug('refund')).toBe(true);
    expect(ensureUniqueStoreSlug('dashboard', [])).toBe('dashboard-store');
    expect(ensureUniqueStoreSlug(seongsuHouse, ['\uC131\uC218-\uBE0C\uB7F0\uCE58-\uD558\uC6B0\uC2A4'])).toBe(
      '\uC131\uC218-\uBE0C\uB7F0\uCE58-\uD558\uC6B0\uC2A4-2',
    );
  });

  it('builds the public route paths', () => {
    expect(buildStorePath('golden-coffee', 'order')).toBe('/golden-coffee/order');
    expect(buildStorePath('\uC131\uC218-\uBE0C\uB7F0\uCE58-\uD558\uC6B0\uC2A4', 'menu')).toBe(
      '/\uC131\uC218-\uBE0C\uB7F0\uCE58-\uD558\uC6B0\uC2A4/menu',
    );
    expect(buildStoreIdPath('store_golden_coffee')).toBe('/store/store_golden_coffee');
    expect(buildStoreIdPath('store_golden_coffee', 'order')).toBe('/store/store_golden_coffee/order');
  });
});
