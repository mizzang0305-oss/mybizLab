import { matchOrCreateCustomer } from '@/shared/lib/domain/customers';

describe('customer matching', () => {
  it('matches an existing customer by phone and increments visits', () => {
    const result = matchOrCreateCustomer(
      [
        {
          id: 'customer_1',
          store_id: 'store_1',
          name: '김하나',
          phone: '010-1111-1111',
          email: 'hana@example.com',
          visit_count: 2,
          last_visit_at: '2026-03-10T00:00:00.000Z',
          is_regular: false,
          marketing_opt_in: true,
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
      {
        storeId: 'store_1',
        phone: '010-1111-1111',
        name: '김하나',
        marketingOptIn: true,
        visitedAt: '2026-03-13T00:00:00.000Z',
      },
    );

    expect(result.created).toBe(false);
    expect(result.customer.visit_count).toBe(3);
    expect(result.customer.is_regular).toBe(true);
  });

  it('creates a new customer when no phone match exists', () => {
    const result = matchOrCreateCustomer([], {
      storeId: 'store_1',
      phone: '010-9999-9999',
      name: '새 고객',
    });

    expect(result.created).toBe(true);
    expect(result.customer.phone).toBe('010-9999-9999');
  });
});
