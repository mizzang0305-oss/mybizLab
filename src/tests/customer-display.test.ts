import { describe, expect, it } from 'vitest';

import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';

describe('customer display label', () => {
  it('prefers a real customer name when it exists', () => {
    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '김고객',
          phone: '010-7000-1005',
          email: 'kim@example.com',
        },
      }),
    ).toBe('김고객');
  });

  it('falls back to phone or email before calling a linked customer unregistered', () => {
    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '고객',
          phone: '010-7000-1005',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('010-7000-1005');

    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '고객',
          email: 'qa.order.link@mybiz.ai',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('qa.order.link@mybiz.ai');
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
    ).toBe('010-7000-1005');

    expect(
      getCustomerDisplayLabel({
        customer: {
          name: '怨좉컼 ?곷떞',
          email: 'linked.customer@example.com',
        },
        customerId: 'customer_live_001',
      }),
    ).toBe('linked.customer@example.com');
  });

  it('uses a linked-customer label when a customer id exists but no display fields survive', () => {
    expect(getCustomerDisplayLabel({ customerId: 'customer_live_001' })).toBe('연결 고객');
    expect(getCustomerDisplayLabel({})).toBe('미등록 고객');
  });
});
