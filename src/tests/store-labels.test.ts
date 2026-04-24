import { describe, expect, it } from 'vitest';

import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';

describe('store label helpers', () => {
  it('falls back to a neutral label when business type is missing', () => {
    expect(getBusinessTypeLabel('')).toBe('매장');
    expect(getBusinessTypeLabel(undefined)).toBe('매장');
  });

  it('maps known business type keywords to customer-facing labels', () => {
    expect(getBusinessTypeLabel('brunch')).toBe('브런치 카페');
    expect(getBusinessTypeLabel('coffee')).toBe('카페');
    expect(getBusinessTypeLabel('bbq')).toBe('고깃집');
  });
});
