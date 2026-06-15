import type {
  Customer,
  CustomerContact,
  CustomerTimelineEvent,
  Inquiry,
  InquiryStatus,
} from '../../types/models.js';

export interface InquiryInboxReadRepository {
  listCustomerContacts: (storeId: string, customerId?: string) => Promise<CustomerContact[]>;
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  listInquiries: (storeId: string) => Promise<Inquiry[]>;
}

export interface InquiryInboxReadModelInput {
  contacts: CustomerContact[];
  customers: Customer[];
  inquiries: Inquiry[];
  status?: InquiryStatus;
  storeId: string;
  timelineEvents: CustomerTimelineEvent[];
}

export interface InquiryInboxReadModelItem {
  category: Inquiry['category'];
  createdAt: string;
  customerLinked: boolean;
  id: string;
  intent: string;
  latestTimelineAt?: string;
  latestTimelineEventSummary: string;
  latestTimelineEventType?: CustomerTimelineEvent['event_type'];
  linkedCustomerId: string | null;
  maskedContactChannel: string;
  maskedCustomerDisplayName: string;
  needsFollowUp: boolean;
  status: InquiryStatus;
  storeId: string;
  subject: string;
  summary: string;
  tags: string[];
}

export interface InquiryInboxReadModel {
  counts: {
    byStatus: Record<InquiryStatus, number>;
    linked: number;
    needsFollowUp: number;
    total: number;
    unlinked: number;
  };
  items: InquiryInboxReadModelItem[];
  storeId: string;
}

const INQUIRY_STATUS_VALUES: InquiryStatus[] = ['new', 'in_progress', 'completed', 'on_hold'];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePhone(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

function normalizeEmail(value?: string | null) {
  return normalizeText(value).toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeText(value: unknown, sensitiveTerms: string[] = [], maxLength = 140) {
  let text = normalizeText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]');

  sensitiveTerms
    .map((term) => normalizeText(term))
    .filter((term) => term.length >= 2)
    .forEach((term) => {
      text = text.replace(new RegExp(escapeRegExp(term), 'gi'), '[customer]');
    });

  return text.slice(0, maxLength);
}

function maskPhone(value?: string | null) {
  const normalized = normalizePhone(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.length <= 4 ? '****' : `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function maskEmail(value?: string | null) {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return undefined;
  }

  const [local, domain] = normalized.split('@');
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
}

function maskName(value?: string | null) {
  const trimmed = normalizeText(value);
  return trimmed ? `${trimmed.slice(0, 1)}***` : 'Unknown customer';
}

function getCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function newestTimeline(events: CustomerTimelineEvent[]) {
  return events
    .slice()
    .sort((left, right) =>
      (right.occurred_at || right.created_at || '').localeCompare(left.occurred_at || left.created_at || ''),
    )[0];
}

function resolveContactChannel(input: {
  contacts: CustomerContact[];
  customer?: Customer;
  inquiry: Inquiry;
}) {
  const phoneContact = input.contacts.find((contact) => contact.type === 'phone');
  const emailContact = input.contacts.find((contact) => contact.type === 'email');
  const maskedPhone = maskPhone(phoneContact?.value || input.customer?.phone || input.inquiry.phone);
  if (maskedPhone) {
    return `phone: ${maskedPhone}`;
  }

  const maskedEmail = maskEmail(emailContact?.value || input.customer?.email || input.inquiry.email);
  if (maskedEmail) {
    return `email: ${maskedEmail}`;
  }

  return 'none';
}

export function buildInquiryInboxReadModel(input: InquiryInboxReadModelInput): InquiryInboxReadModel {
  const storeCustomers = input.customers.filter((customer) => customer.store_id === input.storeId);
  const customersById = new Map(storeCustomers.map((customer) => [getCustomerId(customer), customer]));
  const storeContacts = input.contacts.filter((contact) => contact.store_id === input.storeId);
  const storeTimeline = input.timelineEvents.filter((event) => event.store_id === input.storeId);
  const storeInquiries = input.inquiries
    .filter((inquiry) => inquiry.store_id === input.storeId)
    .filter((inquiry) => !input.status || inquiry.status === input.status)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  const items = storeInquiries.map((inquiry) => {
    const linkedCustomer = inquiry.customer_id ? customersById.get(inquiry.customer_id) : undefined;
    const linkedCustomerId = linkedCustomer ? getCustomerId(linkedCustomer) : null;
    const customerContacts = linkedCustomerId
      ? storeContacts.filter((contact) => contact.customer_id === linkedCustomerId)
      : [];
    const customerTimeline = linkedCustomerId
      ? storeTimeline.filter((event) => event.customer_id === linkedCustomerId)
      : [];
    const latestTimelineEvent = newestTimeline(customerTimeline);
    const sensitiveTerms = [linkedCustomer?.name, inquiry.customer_name].filter(Boolean) as string[];
    const tags = inquiry.tags.map((tag) => sanitizeText(tag, sensitiveTerms, 36)).filter(Boolean);

    return {
      category: inquiry.category,
      createdAt: inquiry.created_at,
      customerLinked: Boolean(linkedCustomer),
      id: inquiry.id,
      intent: tags.slice(0, 3).join(', ') || inquiry.category,
      latestTimelineAt: latestTimelineEvent?.occurred_at,
      latestTimelineEventSummary: latestTimelineEvent
        ? sanitizeText(latestTimelineEvent.summary, sensitiveTerms, 120)
        : 'No linked customer timeline yet.',
      latestTimelineEventType: latestTimelineEvent?.event_type,
      linkedCustomerId,
      maskedContactChannel: resolveContactChannel({
        contacts: customerContacts,
        customer: linkedCustomer,
        inquiry,
      }),
      maskedCustomerDisplayName: maskName(linkedCustomer?.name || inquiry.customer_name),
      needsFollowUp: inquiry.status !== 'completed',
      status: inquiry.status,
      storeId: inquiry.store_id,
      subject: tags[0] || inquiry.category,
      summary: sanitizeText(inquiry.message || inquiry.memo || '', sensitiveTerms, 120),
      tags,
    } satisfies InquiryInboxReadModelItem;
  });

  return {
    counts: {
      byStatus: INQUIRY_STATUS_VALUES.reduce(
        (acc, status) => {
          acc[status] = items.filter((item) => item.status === status).length;
          return acc;
        },
        {} as Record<InquiryStatus, number>,
      ),
      linked: items.filter((item) => item.customerLinked).length,
      needsFollowUp: items.filter((item) => item.needsFollowUp).length,
      total: items.length,
      unlinked: items.filter((item) => !item.customerLinked).length,
    },
    items,
    storeId: input.storeId,
  };
}

export async function listInquiryInboxReadModel(input: {
  repository: InquiryInboxReadRepository;
  status?: InquiryStatus;
  storeId: string;
}) {
  const [customers, contacts, inquiries, timelineEvents] = await Promise.all([
    input.repository.listCustomers(input.storeId),
    input.repository.listCustomerContacts(input.storeId),
    input.repository.listInquiries(input.storeId),
    input.repository.listCustomerTimelineEvents(input.storeId),
  ]);

  return buildInquiryInboxReadModel({
    contacts,
    customers,
    inquiries,
    status: input.status,
    storeId: input.storeId,
    timelineEvents,
  });
}
