import { createId } from '@/shared/lib/ids';
import {
  buildCustomerContact,
  buildCustomerPreference,
  buildCustomerTimelineEvent,
  getCustomerRecordId,
  mergeCustomerRecord,
  normalizeCustomerEmail,
  normalizeCustomerRecord,
  normalizeCustomerPhone,
} from '@/shared/lib/domain/customerMemory';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import type { CanonicalCustomerMemoryRepository } from '@/shared/lib/repositories';
import type { Customer, CustomerContact, CustomerPreference } from '@/shared/types/models';
import type { CustomerMemoryRecord, CustomerMemoryUpsertInput } from '@/shared/lib/repositories/contracts';

function nowIso() {
  return new Date().toISOString();
}

function resolveCustomerMatch(
  customers: Customer[],
  contacts: CustomerContact[],
  input: Pick<CustomerMemoryUpsertInput, 'customerId' | 'email' | 'phone'>,
) {
  const normalizedPhone = normalizeCustomerPhone(input.phone);
  const normalizedEmail = normalizeCustomerEmail(input.email);

  const directCustomer = input.customerId
    ? customers.find((customer) => getCustomerRecordId(customer) === input.customerId) || null
    : null;
  const phoneContact = normalizedPhone
    ? contacts.find((contact) => contact.type === 'phone' && contact.normalized_value === normalizedPhone) || null
    : null;
  const emailContact = normalizedEmail
    ? contacts.find((contact) => contact.type === 'email' && contact.normalized_value === normalizedEmail) || null
    : null;
  const phoneCustomer = phoneContact
    ? customers.find((customer) => getCustomerRecordId(customer) === phoneContact.customer_id) || null
    : null;
  const emailCustomer = emailContact
    ? customers.find((customer) => getCustomerRecordId(customer) === emailContact.customer_id) || null
    : null;
  const duplicateConflict =
    Boolean(phoneCustomer && emailCustomer && getCustomerRecordId(phoneCustomer) !== getCustomerRecordId(emailCustomer));

  return {
    customer: directCustomer || phoneCustomer || emailCustomer || null,
    duplicateConflict,
    normalizedEmail,
    normalizedPhone,
  };
}

export async function listStoreCustomers(storeId: string) {
  const repository = getCanonicalMyBizRepository();
  const customers = await repository.listCustomers(storeId);

  return customers
    .slice()
    .sort((left, right) => (right.last_visit_at || right.created_at).localeCompare(left.last_visit_at || left.created_at));
}

export async function upsertCustomerMemory(
  input: CustomerMemoryUpsertInput,
  options?: {
    repository?: CanonicalCustomerMemoryRepository;
  },
): Promise<CustomerMemoryRecord> {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const timestamp = nowIso();
  const [customers, contacts, preferences] = await Promise.all([
    repository.listCustomers(input.storeId),
    repository.listCustomerContacts(input.storeId),
    repository.listCustomerPreferences(input.storeId),
  ]);

  const match = resolveCustomerMatch(customers, contacts, input);
  const created = !match.customer;
  const baseCustomer: Customer = normalizeCustomerRecord(
    match.customer || {
      id: createId('customer'),
      customer_id: undefined,
      store_id: input.storeId,
      name: input.name?.trim() || '고객',
      phone: input.phone?.trim() || '',
      email: input.email?.trim().toLowerCase() || undefined,
      visit_count: 0,
      last_visit_at: undefined,
      is_regular: false,
      marketing_opt_in: Boolean(input.marketingOptIn),
      created_at: timestamp,
      updated_at: timestamp,
    },
  );

  const nextCustomer = created
    ? {
        ...baseCustomer,
        name: input.name?.trim() || baseCustomer.name,
        phone: input.phone?.trim() || baseCustomer.phone,
        email: input.email?.trim().toLowerCase() || baseCustomer.email,
        marketing_opt_in: input.marketingOptIn ?? baseCustomer.marketing_opt_in,
        updated_at: timestamp,
      }
    : mergeCustomerRecord(baseCustomer, {
        email: input.email,
        marketingOptIn: input.marketingOptIn,
        name: input.name,
        phone: input.phone,
        timestamp,
        visitIncrement: input.visitIncrement,
      });

  const savedCustomer = normalizeCustomerRecord(await repository.saveCustomer(normalizeCustomerRecord(nextCustomer)));
  const savedCustomerId = getCustomerRecordId(savedCustomer);

  const currentContacts = contacts.filter((contact) => contact.customer_id === savedCustomerId);
  const nextContacts: CustomerContact[] = [];
  if (match.normalizedPhone) {
    const existingPhoneContact =
      contacts.find((contact) => contact.type === 'phone' && contact.normalized_value === match.normalizedPhone) ||
      currentContacts.find((contact) => contact.type === 'phone') ||
      null;
    const phoneContact = existingPhoneContact
      ? {
          ...existingPhoneContact,
          store_id: input.storeId,
          customer_id: savedCustomerId,
          value: input.phone!.trim(),
          normalized_value: match.normalizedPhone,
          is_primary: true,
          updated_at: timestamp,
        }
      : buildCustomerContact({
          customerId: savedCustomerId,
          isPrimary: true,
          storeId: input.storeId,
          timestamp,
          type: 'phone',
          value: input.phone!,
        });
    nextContacts.push(await repository.saveCustomerContact(phoneContact));
  }

  if (match.normalizedEmail) {
    const existingEmailContact =
      contacts.find((contact) => contact.type === 'email' && contact.normalized_value === match.normalizedEmail) ||
      currentContacts.find((contact) => contact.type === 'email') ||
      null;
    const emailContact = existingEmailContact
      ? {
          ...existingEmailContact,
          store_id: input.storeId,
          customer_id: savedCustomerId,
          value: input.email!.trim().toLowerCase(),
          normalized_value: match.normalizedEmail,
          is_primary: !match.normalizedPhone,
          updated_at: timestamp,
        }
      : buildCustomerContact({
          customerId: savedCustomerId,
          isPrimary: !match.normalizedPhone,
          storeId: input.storeId,
          timestamp,
          type: 'email',
          value: input.email!,
        });
    nextContacts.push(await repository.saveCustomerContact(emailContact));
  }

  const existingPreference = preferences.find((preference) => preference.customer_id === savedCustomerId) || null;
  const nextPreference: CustomerPreference =
    existingPreference
      ? {
          ...existingPreference,
          marketing_opt_in: input.marketingOptIn ?? existingPreference.marketing_opt_in,
          updated_at: timestamp,
        }
      : buildCustomerPreference({
          customerId: savedCustomerId,
          marketingOptIn: input.marketingOptIn,
          storeId: input.storeId,
          timestamp,
        });
  const savedPreference = await repository.saveCustomerPreference(nextPreference);

  const timelineEvent = await repository.appendTimelineEvent(
    buildCustomerTimelineEvent({
      customerId: savedCustomerId,
      eventType: input.eventType || (created ? 'customer_created' : 'contact_captured'),
      metadata: {
        email: input.email?.trim().toLowerCase() || null,
        normalizedEmail: match.normalizedEmail || null,
        normalizedPhone: match.normalizedPhone || null,
        phone: input.phone?.trim() || null,
        ...(input.metadata || {}),
      },
      occurredAt: input.occurredAt,
      source: input.source,
      storeId: input.storeId,
      summary: input.summary,
      timestamp,
    }),
  );

  return {
    contacts: nextContacts,
    created,
    customer: savedCustomer,
    duplicateConflict: match.duplicateConflict,
    preference: savedPreference,
    timelineEvent,
  };
}
