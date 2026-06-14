import { createId } from '../../../shared/lib/ids';
import {
  buildCustomerContact,
  buildCustomerTimelineEvent,
  getCustomerRecordId,
  mergeCustomerRecord,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerRecord,
} from '../../../shared/lib/domain/customerMemory';
import { normalizeInquiryTags } from '../../../shared/lib/inquirySchema';
import type {
  Customer,
  CustomerContact,
  CustomerTimelineEvent,
  Inquiry,
  InquiryCategory,
} from '../../../shared/types/models';
import type { CustomerMemoryIntakeRepository } from '../repositories/customerRepository';

export interface CustomerMemoryInquiryIntakeInput {
  category?: InquiryCategory;
  email?: string;
  intent?: string;
  marketingOptIn?: boolean;
  message: string;
  name: string;
  phone?: string;
  requestedVisitDate?: string;
  source?: 'dashboard' | 'public_inquiry' | 'public_store';
  storeId: string;
  summary?: string;
  tags?: string[];
}

export interface CustomerMemoryInquiryIntakeResult {
  contacts: CustomerContact[];
  created: boolean;
  customer: Customer;
  inquiry: Inquiry;
  timelineEvents: CustomerTimelineEvent[];
}

export interface AdminCustomerMemoryCard {
  contactChannels: Array<'email' | 'phone'>;
  customerId: string;
  displayName: string;
  lastTimelineAt?: string;
  maskedEmail?: string;
  maskedPhone?: string;
  recentInquiry?: {
    category: InquiryCategory;
    id: string;
    messagePreview: string;
    status: Inquiry['status'];
  };
  timelineCount: number;
}

export interface AdminCustomerMemoryDetail extends AdminCustomerMemoryCard {
  contacts: Array<{
    isPrimary: boolean;
    maskedValue: string;
    type: CustomerContact['type'];
  }>;
  inquiries: Array<{
    category: InquiryCategory;
    id: string;
    messagePreview: string;
    status: Inquiry['status'];
    tags: string[];
  }>;
  timeline: Array<{
    eventType: CustomerTimelineEvent['event_type'];
    id: string;
    metadata: CustomerTimelineEvent['metadata'];
    occurredAt: string;
    summary: string;
  }>;
}

export interface AdminCustomerMemoryReadModel {
  customers: AdminCustomerMemoryCard[];
  detail?: AdminCustomerMemoryDetail;
  storeId: string;
}

const CONTACT_METADATA_KEYS = new Set(['email', 'name', 'normalizedEmail', 'normalizedPhone', 'phone']);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertValidInput(input: CustomerMemoryInquiryIntakeInput) {
  const storeId = normalizeText(input.storeId);
  const name = normalizeText(input.name);
  const message = normalizeText(input.message);
  const phone = normalizeText(input.phone);
  const email = normalizeText(input.email).toLowerCase();
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedEmail = normalizeCustomerEmail(email);

  if (!storeId) {
    throw new Error('STORE_ID_REQUIRED');
  }

  if (name.length < 2) {
    throw new Error('CUSTOMER_NAME_REQUIRED');
  }

  if (!normalizedPhone && !normalizedEmail) {
    throw new Error('CUSTOMER_CONTACT_REQUIRED');
  }

  if (phone && normalizedPhone.length < 7) {
    throw new Error('CUSTOMER_PHONE_INVALID');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('CUSTOMER_EMAIL_INVALID');
  }

  if (message.length < 10) {
    throw new Error('INQUIRY_MESSAGE_REQUIRED');
  }

  return {
    email: normalizedEmail ? email : undefined,
    message,
    name,
    normalizedEmail,
    normalizedPhone,
    phone: normalizedPhone ? phone : undefined,
    storeId,
  };
}

function inferInquiryCategory(input: CustomerMemoryInquiryIntakeInput): InquiryCategory {
  if (input.category) {
    return input.category;
  }

  const haystack = `${input.intent || ''} ${input.message || ''}`.toLowerCase();
  if (/예약|reservation|booking/.test(haystack)) {
    return 'reservation';
  }

  if (/단체|group/.test(haystack)) {
    return 'group_booking';
  }

  if (/행사|event/.test(haystack)) {
    return 'event';
  }

  if (/브랜드|brand/.test(haystack)) {
    return 'brand';
  }

  return 'general';
}

function maskPhone(value?: string) {
  const normalized = normalizeCustomerPhone(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.length <= 4 ? '****' : `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function maskEmail(value?: string) {
  const normalized = normalizeCustomerEmail(value);
  if (!normalized) {
    return undefined;
  }

  const [local, domain] = normalized.split('@');
  if (!domain) {
    return '***';
  }

  return `${local.slice(0, 1)}***@${domain}`;
}

function maskName(value?: string) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return 'Customer';
  }

  return `${trimmed.slice(0, 1)}***`;
}

function sanitizeMessagePreview(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]')
    .slice(0, 96);
}

function sanitizeTimelineMetadata(metadata: CustomerTimelineEvent['metadata']) {
  return Object.fromEntries(
    Object.entries(metadata || {}).filter(([key]) => !CONTACT_METADATA_KEYS.has(key)),
  ) as CustomerTimelineEvent['metadata'];
}

function findCustomerMatch(input: {
  contacts: CustomerContact[];
  customers: Customer[];
  normalizedEmail: string;
  normalizedPhone: string;
  storeId: string;
}) {
  const phoneContact = input.normalizedPhone
    ? input.contacts.find(
        (contact) =>
          contact.store_id === input.storeId &&
          contact.type === 'phone' &&
          contact.normalized_value === input.normalizedPhone,
      )
    : null;
  const emailContact = input.normalizedEmail
    ? input.contacts.find(
        (contact) =>
          contact.store_id === input.storeId &&
          contact.type === 'email' &&
          contact.normalized_value === input.normalizedEmail,
      )
    : null;
  const matchedContact = phoneContact || emailContact || null;
  const contactCustomer = matchedContact
    ? input.customers.find((customer) => getCustomerRecordId(customer) === matchedContact.customer_id)
    : null;

  if (contactCustomer) {
    return contactCustomer;
  }

  return (
    input.customers.find((customer) => {
      const samePhone = input.normalizedPhone && normalizeCustomerPhone(customer.phone) === input.normalizedPhone;
      const sameEmail = input.normalizedEmail && normalizeCustomerEmail(customer.email) === input.normalizedEmail;
      return customer.store_id === input.storeId && Boolean(samePhone || sameEmail);
    }) || null
  );
}

async function saveContacts(input: {
  customerId: string;
  email?: string;
  existingContacts: CustomerContact[];
  normalizedEmail: string;
  normalizedPhone: string;
  phone?: string;
  repository: CustomerMemoryIntakeRepository;
  storeId: string;
  timestamp: string;
}) {
  const contacts: CustomerContact[] = [];

  if (input.normalizedPhone && input.phone) {
    const existingPhone =
      input.existingContacts.find(
        (contact) => contact.store_id === input.storeId && contact.type === 'phone' && contact.normalized_value === input.normalizedPhone,
      ) || null;
    contacts.push(
      await input.repository.saveCustomerContact(
        existingPhone
          ? {
              ...existingPhone,
              customer_id: input.customerId,
              is_primary: true,
              updated_at: input.timestamp,
              value: input.phone,
            }
          : buildCustomerContact({
              customerId: input.customerId,
              isPrimary: true,
              storeId: input.storeId,
              timestamp: input.timestamp,
              type: 'phone',
              value: input.phone,
            }),
      ),
    );
  }

  if (input.normalizedEmail && input.email) {
    const existingEmail =
      input.existingContacts.find(
        (contact) => contact.store_id === input.storeId && contact.type === 'email' && contact.normalized_value === input.normalizedEmail,
      ) || null;
    contacts.push(
      await input.repository.saveCustomerContact(
        existingEmail
          ? {
              ...existingEmail,
              customer_id: input.customerId,
              is_primary: !input.normalizedPhone,
              updated_at: input.timestamp,
              value: input.email,
            }
          : buildCustomerContact({
              customerId: input.customerId,
              isPrimary: !input.normalizedPhone,
              storeId: input.storeId,
              timestamp: input.timestamp,
              type: 'email',
              value: input.email,
            }),
      ),
    );
  }

  return contacts;
}

async function appendTimelineEvent(
  repository: CustomerMemoryIntakeRepository,
  input: {
    customerId: string;
    eventType: CustomerTimelineEvent['event_type'];
    metadata?: CustomerTimelineEvent['metadata'];
    source: CustomerTimelineEvent['source'];
    storeId: string;
    summary: string;
    timestamp: string;
  },
) {
  return repository.appendTimelineEvent(
    buildCustomerTimelineEvent({
      customerId: input.customerId,
      eventType: input.eventType,
      metadata: sanitizeTimelineMetadata(input.metadata || {}),
      source: input.source,
      storeId: input.storeId,
      summary: input.summary,
      timestamp: input.timestamp,
    }),
  );
}

export async function submitCustomerMemoryInquiryIntake(
  input: CustomerMemoryInquiryIntakeInput,
  dependencies: { repository: CustomerMemoryIntakeRepository },
): Promise<CustomerMemoryInquiryIntakeResult> {
  const parsed = assertValidInput(input);
  const repository = dependencies.repository;
  const timestamp = nowIso();
  const [customers, contacts] = await Promise.all([
    repository.listCustomers(parsed.storeId),
    repository.listCustomerContacts(parsed.storeId),
  ]);
  const existingCustomer = findCustomerMatch({
    contacts,
    customers,
    normalizedEmail: parsed.normalizedEmail,
    normalizedPhone: parsed.normalizedPhone,
    storeId: parsed.storeId,
  });
  const created = !existingCustomer;
  const baseCustomer: Customer = existingCustomer
    ? normalizeCustomerRecord(existingCustomer)
    : {
        id: createId('customer'),
        customer_id: undefined,
        store_id: parsed.storeId,
        name: parsed.name,
        phone: parsed.phone || '',
        email: parsed.email,
        visit_count: 0,
        is_regular: false,
        marketing_opt_in: Boolean(input.marketingOptIn),
        created_at: timestamp,
        updated_at: timestamp,
      };
  const savedCustomer = normalizeCustomerRecord(
    await repository.saveCustomer(
      created
        ? normalizeCustomerRecord(baseCustomer)
        : mergeCustomerRecord(baseCustomer, {
            email: parsed.email,
            marketingOptIn: input.marketingOptIn,
            name: parsed.name,
            phone: parsed.phone,
            timestamp,
          }),
    ),
  );
  const customerId = getCustomerRecordId(savedCustomer);
  const savedContacts = await saveContacts({
    customerId,
    email: parsed.email,
    existingContacts: contacts,
    normalizedEmail: parsed.normalizedEmail,
    normalizedPhone: parsed.normalizedPhone,
    phone: parsed.phone,
    repository,
    storeId: parsed.storeId,
    timestamp,
  });
  const category = inferInquiryCategory(input);
  const tags = normalizeInquiryTags([category.replace(/_/g, ' '), input.intent, ...(input.tags || [])]);
  const inquiry = await repository.saveInquiry({
    id: createId('inquiry'),
    store_id: parsed.storeId,
    customer_id: customerId,
    customer_name: parsed.name,
    phone: parsed.phone || '',
    email: parsed.email,
    category,
    status: 'new',
    message: parsed.message,
    tags,
    memo: input.summary?.trim() || '',
    marketing_opt_in: Boolean(input.marketingOptIn),
    requested_visit_date: normalizeText(input.requestedVisitDate) || undefined,
    source: 'public_form',
    created_at: timestamp,
    updated_at: timestamp,
  });
  const timelineEvents: CustomerTimelineEvent[] = [];
  timelineEvents.push(
    await appendTimelineEvent(repository, {
      customerId,
      eventType: created ? 'customer_created' : 'customer_updated',
      metadata: {
        contactIdentity: parsed.normalizedPhone ? 'phone' : 'email',
        source: input.source || 'public_inquiry',
      },
      source: input.source || 'public_inquiry',
      storeId: parsed.storeId,
      summary: created ? 'Customer profile created from inquiry intake.' : 'Customer profile updated from inquiry intake.',
      timestamp,
    }),
  );

  if (savedContacts.length) {
    timelineEvents.push(
      await appendTimelineEvent(repository, {
        customerId,
        eventType: 'contact_added',
        metadata: {
          contactTypes: savedContacts.map((contact) => contact.type).join(','),
          primaryContactType: savedContacts.find((contact) => contact.is_primary)?.type || savedContacts[0]?.type || null,
        },
        source: input.source || 'public_inquiry',
        storeId: parsed.storeId,
        summary: 'Customer contact channel linked to profile.',
        timestamp,
      }),
    );
  }

  timelineEvents.push(
    await appendTimelineEvent(repository, {
      customerId,
      eventType: 'inquiry_created',
      metadata: {
        category,
        inquiryId: inquiry.id,
        tags: tags.join(','),
      },
      source: input.source || 'public_inquiry',
      storeId: parsed.storeId,
      summary: 'Inquiry created from intake form.',
      timestamp,
    }),
  );
  timelineEvents.push(
    await appendTimelineEvent(repository, {
      customerId,
      eventType: 'inquiry_linked_to_customer',
      metadata: {
        inquiryId: inquiry.id,
      },
      source: input.source || 'public_inquiry',
      storeId: parsed.storeId,
      summary: 'Inquiry linked to customer memory profile.',
      timestamp,
    }),
  );

  return {
    contacts: savedContacts,
    created,
    customer: savedCustomer,
    inquiry,
    timelineEvents,
  };
}

export async function buildAdminCustomerMemoryReadModel(
  input: {
    customerId?: string;
    repository: CustomerMemoryIntakeRepository;
    storeId: string;
  },
): Promise<AdminCustomerMemoryReadModel> {
  const [customers, contacts, inquiries, timeline] = await Promise.all([
    input.repository.listCustomers(input.storeId),
    input.repository.listCustomerContacts(input.storeId),
    input.repository.listInquiries(input.storeId),
    input.repository.listCustomerTimelineEvents(input.storeId),
  ]);
  const cards = customers.map((customer) => {
    const customerId = getCustomerRecordId(customer);
    const customerContacts = contacts.filter((contact) => contact.customer_id === customerId);
    const customerInquiries = inquiries
      .filter((inquiry) => inquiry.customer_id === customerId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    const customerTimeline = timeline
      .filter((event) => event.customer_id === customerId)
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
    const phoneContact = customerContacts.find((contact) => contact.type === 'phone');
    const emailContact = customerContacts.find((contact) => contact.type === 'email');

    return {
      contactChannels: customerContacts.map((contact) => contact.type),
      customerId,
      displayName: maskName(customer.name),
      lastTimelineAt: customerTimeline[0]?.occurred_at,
      maskedEmail: maskEmail(emailContact?.value || customer.email),
      maskedPhone: maskPhone(phoneContact?.value || customer.phone),
      recentInquiry: customerInquiries[0]
        ? {
            category: customerInquiries[0].category,
            id: customerInquiries[0].id,
            messagePreview: sanitizeMessagePreview(customerInquiries[0].message),
            status: customerInquiries[0].status,
          }
        : undefined,
      timelineCount: customerTimeline.length,
    } satisfies AdminCustomerMemoryCard;
  });
  const detailCard = input.customerId ? cards.find((card) => card.customerId === input.customerId) : undefined;

  return {
    customers: cards,
    detail: detailCard
      ? {
          ...detailCard,
          contacts: contacts
            .filter((contact) => contact.customer_id === detailCard.customerId)
            .map((contact) => ({
              isPrimary: contact.is_primary,
              maskedValue: contact.type === 'phone' ? maskPhone(contact.value) || '***' : maskEmail(contact.value) || '***',
              type: contact.type,
            })),
          inquiries: inquiries
            .filter((inquiry) => inquiry.customer_id === detailCard.customerId)
            .map((inquiry) => ({
              category: inquiry.category,
              id: inquiry.id,
              messagePreview: sanitizeMessagePreview(inquiry.message),
              status: inquiry.status,
              tags: inquiry.tags,
            })),
          timeline: timeline
            .filter((event) => event.customer_id === detailCard.customerId)
            .map((event) => ({
              eventType: event.event_type,
              id: event.id,
              metadata: sanitizeTimelineMetadata(event.metadata),
              occurredAt: event.occurred_at,
              summary: event.summary,
            })),
        }
      : undefined,
    storeId: input.storeId,
  };
}
