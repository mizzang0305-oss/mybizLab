import type { Customer, CustomerTimelineEvent } from '@/shared/types/models';

export interface CustomerMemoryScope {
  customerId?: string | null;
  storeId?: string | null;
}

export interface CustomerMemoryDedupeInput {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
  storeId?: string | null;
}

export function normalizePhoneForCustomerMemory(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

export function normalizeEmailForCustomerMemory(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export function assertStoreScopedCustomerMemory(scope: CustomerMemoryScope) {
  if (!scope.storeId?.trim()) {
    throw new Error('CUSTOMER_MEMORY_STORE_ID_REQUIRED');
  }

  return scope.storeId.trim();
}

export function assertCustomerTimelineScope(scope: CustomerMemoryScope) {
  const storeId = assertStoreScopedCustomerMemory(scope);

  if (!scope.customerId?.trim()) {
    throw new Error('CUSTOMER_TIMELINE_CUSTOMER_ID_REQUIRED');
  }

  return {
    customerId: scope.customerId.trim(),
    storeId,
  };
}

export function buildStoreLocalCustomerDedupeKey(input: CustomerMemoryDedupeInput) {
  const storeId = assertStoreScopedCustomerMemory(input);
  const phone = normalizePhoneForCustomerMemory(input.phone);
  const email = normalizeEmailForCustomerMemory(input.email);
  const customerId = input.customerId?.trim() || '';

  if (phone) {
    return `${storeId}:phone:${phone}`;
  }

  if (email) {
    return `${storeId}:email:${email}`;
  }

  if (customerId) {
    return `${storeId}:customer:${customerId}`;
  }

  throw new Error('CUSTOMER_MEMORY_DEDUPE_IDENTITY_REQUIRED');
}

export function assertCustomerWriteScope(customer: Pick<Customer, 'store_id'>) {
  return assertStoreScopedCustomerMemory({ storeId: customer.store_id });
}

export function assertTimelineEventWriteScope(
  event: Pick<CustomerTimelineEvent, 'customer_id' | 'store_id'>,
) {
  return assertCustomerTimelineScope({
    customerId: event.customer_id,
    storeId: event.store_id,
  });
}
