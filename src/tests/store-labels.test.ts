import { describe, expect, it } from 'vitest';

import { getStoreBrandConfig } from '@/shared/lib/storeData';
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

  it('removes broken merchant metadata while preserving healthy values', () => {
    const config = getStoreBrandConfig({
      address: '???',
      brand_config: {
        address: '?? ??',
        business_number: '',
        business_type: 'placeholder',
        email: 'owner@mybiz.ai',
        owner_name: '??? ??',
        phone: '010-1111-2222',
      },
      business_number: '123-45-67890',
      business_type: 'demo',
      email: '',
      owner_name: '',
      phone: '',
    });

    expect(config).toMatchObject({
      address: '',
      business_number: '123-45-67890',
      business_type: '',
      email: 'owner@mybiz.ai',
      owner_name: '',
      phone: '010-1111-2222',
    });
  });
});
