/**
 * @deprecated Phase 2 introduces customerMemoryService and canonical customer
 * memory repositories. Keep this helper only while legacy order flows are being
 * phased over.
 */
import type { Customer } from '../../types/models.js';
import { createId } from '../ids.js';

interface MatchCustomerInput {
  storeId: string;
  phone: string;
  name?: string;
  email?: string;
  marketingOptIn?: boolean;
  visitedAt?: string;
}

export function matchOrCreateCustomer(customers: Customer[], input: MatchCustomerInput) {
  const normalizedPhone = input.phone.trim();
  const visitedAt = input.visitedAt || new Date().toISOString();
  const existing = customers.find(
    (customer) => customer.store_id === input.storeId && customer.phone.trim() === normalizedPhone,
  );

  if (existing) {
    const updatedCustomer: Customer = {
      ...existing,
      name: input.name || existing.name,
      email: input.email || existing.email,
      marketing_opt_in: input.marketingOptIn ?? existing.marketing_opt_in,
      visit_count: existing.visit_count + 1,
      last_visit_at: visitedAt,
      is_regular: existing.visit_count + 1 >= 3,
    };

    return {
      created: false,
      customer: updatedCustomer,
      customers: customers.map((customer) => (customer.id === existing.id ? updatedCustomer : customer)),
    };
  }

  const newCustomer: Customer = {
    id: createId('customer'),
    store_id: input.storeId,
    name: input.name || '고객',
    phone: normalizedPhone,
    email: input.email,
    visit_count: 1,
    last_visit_at: visitedAt,
    is_regular: false,
    marketing_opt_in: Boolean(input.marketingOptIn),
    created_at: visitedAt,
  };

  return {
    created: true,
    customer: newCustomer,
    customers: [...customers, newCustomer],
  };
}
