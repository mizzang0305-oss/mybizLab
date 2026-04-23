import type { Customer, CustomerContact, CustomerPreference, CustomerTimelineEvent } from '../../types/models.js';
import { createId } from '../ids.js';

export function normalizeCustomerPhone(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

export function normalizeCustomerEmail(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export function getCustomerRecordId(customer: Pick<Customer, 'customer_id' | 'id'> | null | undefined) {
  return customer?.customer_id || customer?.id || '';
}

export function normalizeCustomerRecord(customer: Customer): Customer {
  const customerId = getCustomerRecordId(customer);

  return {
    ...customer,
    id: customerId,
    customer_id: customerId,
  };
}

export function sortCustomerRoleWeight(role: 'owner' | 'manager' | 'staff') {
  if (role === 'owner') {
    return 3;
  }

  if (role === 'manager') {
    return 2;
  }

  return 1;
}

export function buildCustomerContact(input: {
  customerId: string;
  isPrimary?: boolean;
  storeId: string;
  timestamp: string;
  type: CustomerContact['type'];
  value: string;
}): CustomerContact {
  const normalizedValue =
    input.type === 'phone' ? normalizeCustomerPhone(input.value) : normalizeCustomerEmail(input.value);

  return {
    id: createId(`customer_contact_${input.type}`),
    store_id: input.storeId,
    customer_id: input.customerId,
    type: input.type,
    value: input.value.trim(),
    normalized_value: normalizedValue,
    is_primary: input.isPrimary ?? true,
    is_verified: false,
    created_at: input.timestamp,
    updated_at: input.timestamp,
  };
}

export function buildCustomerPreference(input: {
  customerId: string;
  marketingOptIn?: boolean;
  storeId: string;
  timestamp: string;
}): CustomerPreference {
  return {
    id: createId('customer_preference'),
    store_id: input.storeId,
    customer_id: input.customerId,
    marketing_opt_in: Boolean(input.marketingOptIn),
    preference_tags: [],
    created_at: input.timestamp,
    updated_at: input.timestamp,
  };
}

export function buildCustomerTimelineEvent(input: {
  customerId: string;
  eventType: CustomerTimelineEvent['event_type'];
  metadata?: CustomerTimelineEvent['metadata'];
  occurredAt?: string;
  source: CustomerTimelineEvent['source'];
  storeId: string;
  summary: string;
  timestamp: string;
}): CustomerTimelineEvent {
  return {
    id: createId('customer_timeline'),
    store_id: input.storeId,
    customer_id: input.customerId,
    event_type: input.eventType,
    source: input.source,
    summary: input.summary.trim(),
    metadata: input.metadata || {},
    occurred_at: input.occurredAt || input.timestamp,
    created_at: input.timestamp,
  };
}

export function mergeCustomerRecord(
  customer: Customer,
  input: {
    email?: string;
    marketingOptIn?: boolean;
    name?: string;
    phone?: string;
    timestamp: string;
    visitIncrement?: number;
  },
): Customer {
  const normalizedCustomer = normalizeCustomerRecord(customer);
  const visitCount = normalizedCustomer.visit_count + (input.visitIncrement ?? 0);

  return {
    ...normalizedCustomer,
    name: input.name?.trim() || normalizedCustomer.name,
    phone: input.phone?.trim() || normalizedCustomer.phone,
    email: input.email?.trim().toLowerCase() || normalizedCustomer.email,
    marketing_opt_in: input.marketingOptIn ?? normalizedCustomer.marketing_opt_in,
    visit_count: visitCount,
    last_visit_at: input.visitIncrement ? input.timestamp : normalizedCustomer.last_visit_at,
    is_regular: visitCount >= 3,
    updated_at: input.timestamp,
  };
}
