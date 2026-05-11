import { describe, expect, it } from 'vitest';

import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';

describe('customer display label', () => {
  it('prefers a healthy Korean customer name when it exists', () => {
    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '김하나',
          phone: '010-7000-1005',
          email: 'kim@example.com',
        },
      }),
    ).toBe('김하나');
  });

  it('masks phone or email before calling a linked customer unregistered', () => {
    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '고객',
          phone: '010-7000-1005',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('고객 010-****-1005');

    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '고객',
          email: 'minji@example.com',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('고객 m***@example.com');
  });

  it('does not expose corrupted customer names on merchant order surfaces', () => {
    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '???? ??',
          phone: '010-7000-1005',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('고객 010-****-1005');

    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '怨좉컼',
        },
        customerId: 'a1b2c3d4-e5f6-7890-abcd-111122223333',
      }),
    ).toBe('고객 #223333');
  });

  it('uses a linked-customer label when a customer id exists but no display fields survive', () => {
    expect(getCustomerDisplayLabel({ customerId: 'a1b2c3d4-e5f6-7890-abcd-111122223333' })).toBe('고객 #223333');
    expect(getCustomerDisplayLabel({ customerKey: 'customer_key_abcdef' })).toBe('고객 #abcdef');
    expect(getCustomerDisplayLabel({})).toBe('미등록 고객');
  });
});
