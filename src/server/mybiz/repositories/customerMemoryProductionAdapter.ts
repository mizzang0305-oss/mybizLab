import type { Customer, CustomerContact, CustomerTimelineEvent, Inquiry } from '../../../shared/types/models';
import {
  getCustomerRecordId,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerRecord,
} from '../../../shared/lib/domain/customerMemory';
import {
  assertCustomerMemorySpineWriteAllowed,
  type CustomerMemoryIntakeRepository,
  type CustomerMemorySpineWriteApproval,
} from './customerRepository';

type QueryResult = {
  data?: Record<string, unknown>[] | null;
  error?: { code?: string; message?: string } | null;
};

type QueryLike = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => QueryLike;
  in: (column: string, values: unknown[]) => QueryLike;
  limit?: (count: number) => QueryLike;
  order?: (column: string, options?: { ascending?: boolean }) => QueryLike;
};

type TableLike = {
  insert: (payload: Record<string, unknown>) => PromiseLike<{ error?: { code?: string; message?: string } | null }>;
  select: (columns: string) => QueryLike;
  upsert: (
    payload: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => PromiseLike<{ error?: { code?: string; message?: string } | null }>;
};

export type CustomerMemorySupabaseClientLike = {
  from: (table: string) => TableLike;
};

const SENSITIVE_TIMELINE_KEYS = [
  'contactemail',
  'contactname',
  'contactphone',
  'customeremail',
  'customername',
  'customerphone',
  'email',
  'name',
  'normalizedemail',
  'normalizedphone',
  'phone',
];

function nowIso() {
  return new Date().toISOString();
}

function text(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function int(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function primitiveRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, candidate]) => [
      key,
      typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean' || candidate === null
        ? candidate
        : text(candidate) || null,
    ]),
  ) as Record<string, boolean | number | string | null>;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => text(entry)).filter(Boolean);
  }

  return text(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createUuidLike() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function productionUuid(value: unknown) {
  const normalized = text(value);
  return normalized && isUuidLike(normalized) ? normalized : createUuidLike();
}

function uuidReference(value: unknown) {
  const normalized = text(value);
  return normalized && isUuidLike(normalized) ? normalized : null;
}

function normalizeEventType(value: unknown): CustomerTimelineEvent['event_type'] {
  const normalized = text(value);
  const supported: CustomerTimelineEvent['event_type'][] = [
    'customer_created',
    'customer_updated',
    'contact_added',
    'contact_captured',
    'preference_updated',
    'note_added',
    'inquiry_created',
    'inquiry_linked_to_customer',
    'inquiry_captured',
    'reservation_captured',
    'waitlist_captured',
    'order_linked',
    'reservation_updated',
    'waitlist_updated',
    'conversation_started',
    'conversation_message',
  ];

  return supported.includes(normalized as CustomerTimelineEvent['event_type'])
    ? (normalized as CustomerTimelineEvent['event_type'])
    : 'note_added';
}

function normalizeSource(value: unknown): CustomerTimelineEvent['source'] {
  const normalized = text(value);
  const supported: CustomerTimelineEvent['source'][] = [
    'dashboard',
    'public_store',
    'public_inquiry',
    'public_waiting',
    'public_order',
    'reservation',
    'waiting',
    'conversation',
    'system',
    'demo_seed',
  ];

  return supported.includes(normalized as CustomerTimelineEvent['source'])
    ? (normalized as CustomerTimelineEvent['source'])
    : 'system';
}

function normalizeInquiryStatus(value: unknown): Inquiry['status'] {
  const normalized = text(value);
  if (normalized === 'new' || normalized === 'in_progress' || normalized === 'completed' || normalized === 'on_hold') {
    return normalized;
  }

  if (normalized === 'closed') {
    return 'completed';
  }

  return 'new';
}

function normalizeInquiryCategory(value: unknown): Inquiry['category'] {
  const normalized = text(value).toLowerCase();
  if (
    normalized === 'general' ||
    normalized === 'reservation' ||
    normalized === 'group_booking' ||
    normalized === 'event' ||
    normalized === 'brand'
  ) {
    return normalized;
  }

  return 'general';
}

function sortedNewest<T extends { created_at?: string; updated_at?: string }>(rows: T[]) {
  return rows
    .slice()
    .sort((left, right) => (right.updated_at || right.created_at || '').localeCompare(left.updated_at || left.created_at || ''));
}

async function rows(query: QueryLike, context: string) {
  const result = await query;
  if (result.error) {
    throw new Error(`${context}: ${result.error.message || 'unknown Supabase error'}`);
  }

  return result.data || [];
}

export function sanitizeCustomerMemoryTimelinePayload(metadata: CustomerTimelineEvent['metadata']) {
  return Object.fromEntries(
    Object.entries(metadata || {})
      .filter(([key]) => !SENSITIVE_TIMELINE_KEYS.includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')))
      .map(([key, value]) => {
        if (typeof value !== 'string') {
          return [key, typeof value === 'number' || typeof value === 'boolean' || value === null ? value : text(value) || null];
        }

        return [
          key,
          value
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
            .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]'),
        ];
      }),
  ) as CustomerTimelineEvent['metadata'];
}

export function mapProductionCustomerRow(row: Record<string, unknown>): Customer {
  return normalizeCustomerRecord({
    created_at: text(row.created_at || row.first_seen_at) || nowIso(),
    customer_id: text(row.customer_id || row.id),
    email: text(row.email || row.normalized_email) || undefined,
    id: text(row.customer_id || row.id),
    is_regular: bool(row.is_regular, int(row.visit_count) >= 3),
    last_visit_at: text(row.last_visit_at || row.last_seen_at) || undefined,
    marketing_opt_in: bool(row.marketing_opt_in, bool(row.marketing_consent)),
    name: text(row.name) || 'Customer',
    phone: text(row.phone || row.phone_snapshot || row.normalized_phone),
    store_id: text(row.store_id),
    updated_at: text(row.updated_at || row.last_seen_at) || undefined,
    visit_count: int(row.visit_count),
  });
}

export function mapProductionCustomerContactRow(row: Record<string, unknown>, storeId: string): CustomerContact {
  const contactType = text(row.type || row.contact_type) === 'email' ? 'email' : 'phone';
  const value = text(row.value || row.raw_value || row.normalized_value);

  return {
    created_at: text(row.created_at) || nowIso(),
    customer_id: text(row.customer_id),
    id: text(row.id) || createUuidLike(),
    is_primary: bool(row.is_primary, true),
    is_verified: bool(row.is_verified, false),
    normalized_value: text(row.normalized_value || row.value || row.raw_value),
    store_id: storeId,
    type: contactType,
    updated_at: text(row.updated_at || row.created_at) || nowIso(),
    value,
  };
}

export function mapProductionInquiryRow(row: Record<string, unknown>, customer?: Customer | null): Inquiry {
  const message = text(row.message || row.summary || row.subject);

  return {
    category: normalizeInquiryCategory(row.category || row.intent),
    conversation_session_id: text(row.conversation_session_id) || undefined,
    created_at: text(row.created_at) || nowIso(),
    customer_id: text(row.customer_id) || undefined,
    customer_name: text(row.customer_name || row.contact_name) || customer?.name || 'Customer',
    email: text(row.email || row.contact_email) || customer?.email || undefined,
    id: text(row.id),
    marketing_opt_in: bool(row.marketing_opt_in),
    memo: text(row.memo) || undefined,
    message,
    phone: text(row.phone || row.contact_phone) || customer?.phone || '',
    requested_visit_date: text(row.requested_visit_date) || undefined,
    source: text(row.source) === 'owner_manual' ? 'owner_manual' : 'public_form',
    status: normalizeInquiryStatus(row.status),
    store_id: text(row.store_id),
    tags: [...new Set([...stringArray(row.tags), text(row.intent), text(row.channel)].filter(Boolean))],
    updated_at: text(row.updated_at || row.created_at) || nowIso(),
    visitor_session_id: text(row.visitor_session_id) || undefined,
  };
}

export function mapProductionTimelineEventRow(row: Record<string, unknown>): CustomerTimelineEvent {
  const payload = primitiveRecord(row.payload || row.metadata);
  const createdAt = text(row.created_at) || nowIso();

  return {
    created_at: createdAt,
    customer_id: text(row.customer_id),
    event_type: normalizeEventType(row.event_type),
    id: text(row.id) || createUuidLike(),
    metadata: sanitizeCustomerMemoryTimelinePayload(payload),
    occurred_at: text(row.occurred_at || payload.occurred_at || payload.occurredAt) || createdAt,
    source: normalizeSource(row.source || payload.source),
    store_id: text(row.store_id),
    summary: text(row.summary || payload.summary) || normalizeEventType(row.event_type),
  };
}

function customerKey(customer: Customer) {
  return (
    normalizeCustomerPhone(customer.phone) ||
    normalizeCustomerEmail(customer.email) ||
    getCustomerRecordId(customer) ||
    createUuidLike()
  );
}

function toCustomerPayload(customer: Customer) {
  const normalized = normalizeCustomerRecord(customer);
  const customerId = productionUuid(getCustomerRecordId(normalized));

  return {
    appCustomer: normalizeCustomerRecord({
      ...normalized,
      customer_id: customerId,
      id: customerId,
    }),
    payload: {
      customer_id: customerId,
      customer_key: customerKey(normalized),
      first_seen_at: normalized.created_at || nowIso(),
      last_seen_at: normalized.updated_at || normalized.last_visit_at || normalized.created_at || nowIso(),
      marketing_consent: normalized.marketing_opt_in,
      quiet_mode: false,
      quiet_until: null,
      store_id: normalized.store_id,
      tags: [],
    },
  };
}

function toContactPayload(contact: CustomerContact) {
  const contactId = productionUuid(contact.id);

  return {
    appContact: {
      ...contact,
      id: contactId,
    },
    payload: {
      contact_type: contact.type,
      created_at: contact.created_at,
      customer_id: uuidReference(contact.customer_id),
      id: contactId,
      is_primary: contact.is_primary,
      is_verified: contact.is_verified,
      normalized_value: contact.normalized_value,
      raw_value: contact.value,
      store_id: contact.store_id,
    },
  };
}

function toInquiryPayload(inquiry: Inquiry) {
  const inquiryId = productionUuid(inquiry.id);

  return {
    appInquiry: {
      ...inquiry,
      id: inquiryId,
    },
    payload: {
      channel: 'public_page',
      contact_email: inquiry.email || null,
      contact_name: inquiry.customer_name,
      contact_phone: inquiry.phone,
      conversation_session_id: uuidReference(inquiry.conversation_session_id),
      created_at: inquiry.created_at,
      customer_id: uuidReference(inquiry.customer_id),
      id: inquiryId,
      intent: inquiry.category,
      priority_score: 0,
      status: inquiry.status,
      store_id: inquiry.store_id,
      subject: inquiry.customer_name ? `${inquiry.category} inquiry` : 'Customer inquiry',
      summary: inquiry.message,
      updated_at: inquiry.updated_at,
      visitor_session_id: uuidReference(inquiry.visitor_session_id),
    },
  };
}

function toTimelinePayload(event: CustomerTimelineEvent) {
  const eventId = productionUuid(event.id);
  const payload = sanitizeCustomerMemoryTimelinePayload({
    ...event.metadata,
    occurred_at: event.occurred_at,
    source: event.source,
    summary: event.summary,
  });

  return {
    appEvent: {
      ...event,
      id: eventId,
      metadata: sanitizeCustomerMemoryTimelinePayload(event.metadata),
    },
    payload: {
      created_at: event.created_at,
      customer_id: uuidReference(event.customer_id),
      event_type: event.event_type,
      id: eventId,
      payload,
      store_id: event.store_id,
    },
  };
}

export function createProductionCustomerMemorySchemaAdapter(
  client: CustomerMemorySupabaseClientLike,
  approval: CustomerMemorySpineWriteApproval = {},
): CustomerMemoryIntakeRepository {
  async function customerIdSetForStore(storeId: string) {
    const customerRows = await rows(
      client.from('customers').select('customer_id,store_id').eq('store_id', storeId),
      'Failed to load customer ids for customer memory store isolation',
    );

    return new Set(customerRows.map((row) => text(row.customer_id || row.id)).filter(Boolean));
  }

  async function customerBelongsToStore(storeId: string, customerId: string) {
    return (await customerIdSetForStore(storeId)).has(customerId);
  }

  async function customerMapForStore(storeId: string) {
    const customers = await adapter.listCustomers(storeId);
    return new Map(customers.map((customer) => [getCustomerRecordId(customer), customer] as const));
  }

  const adapter: CustomerMemoryIntakeRepository = {
    async appendTimelineEvent(event) {
      assertCustomerMemorySpineWriteAllowed(approval);
      if (!(await customerBelongsToStore(event.store_id, event.customer_id))) {
        throw new Error('CUSTOMER_TIMELINE_STORE_SCOPE_MISMATCH');
      }

      const { appEvent, payload } = toTimelinePayload(event);
      const { error } = await client.from('customer_timeline_events').insert(payload);
      if (error) {
        throw new Error(`Failed to write customer timeline event: ${error.message || 'unknown Supabase error'}`);
      }

      return appEvent;
    },
    async listCustomerContacts(storeId, customerId) {
      const allowedCustomerIds = await customerIdSetForStore(storeId);
      const scopedCustomerIds = customerId ? [customerId].filter((id) => allowedCustomerIds.has(id)) : [...allowedCustomerIds];
      if (!scopedCustomerIds.length) {
        return [];
      }

      const contactRows = await rows(
        client
          .from('customer_contacts')
          .select('id,store_id,customer_id,contact_type,raw_value,normalized_value,is_primary,is_verified,created_at')
          .in('customer_id', scopedCustomerIds),
        'Failed to load customer contacts for customer memory adapter',
      );

      return sortedNewest(
        contactRows
          .filter((row) => allowedCustomerIds.has(text(row.customer_id)))
          .map((row) => mapProductionCustomerContactRow(row, storeId)),
      );
    },
    async listCustomerTimelineEvents(storeId, customerId) {
      let query = client
        .from('customer_timeline_events')
        .select('id,store_id,customer_id,event_type,payload,created_at,source,summary,occurred_at')
        .eq('store_id', storeId);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const eventRows = await rows(query, 'Failed to load customer timeline events for customer memory adapter');
      return eventRows.map(mapProductionTimelineEventRow).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
    },
    async listCustomers(storeId) {
      const customerRows = await rows(
        client
          .from('customers')
          .select(
            'customer_id,store_id,customer_key,name,normalized_phone,normalized_email,visit_count,is_regular,marketing_consent,first_seen_at,last_seen_at,updated_at',
          )
          .eq('store_id', storeId),
        'Failed to load customers for customer memory adapter',
      );

      return sortedNewest(customerRows.map(mapProductionCustomerRow));
    },
    async listInquiries(storeId, customerId) {
      let query = client
        .from('inquiries')
        .select(
          'id,store_id,customer_id,conversation_session_id,visitor_session_id,contact_name,contact_phone,contact_email,category,intent,status,message,summary,subject,tags,memo,marketing_opt_in,requested_visit_date,source,channel,created_at,updated_at',
        )
        .eq('store_id', storeId);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const customers = await customerMapForStore(storeId);
      const inquiryRows = await rows(query, 'Failed to load inquiries for customer memory adapter');
      return sortedNewest(inquiryRows.map((row) => mapProductionInquiryRow(row, customers.get(text(row.customer_id)) || null)));
    },
    async saveCustomer(customer) {
      assertCustomerMemorySpineWriteAllowed(approval);
      const { appCustomer, payload } = toCustomerPayload(customer);
      const { error } = await client.from('customers').upsert(payload, { onConflict: 'customer_id' });
      if (error) {
        throw new Error(`Failed to save customer: ${error.message || 'unknown Supabase error'}`);
      }

      return appCustomer;
    },
    async saveCustomerContact(contact) {
      assertCustomerMemorySpineWriteAllowed(approval);
      if (!(await customerBelongsToStore(contact.store_id, contact.customer_id))) {
        throw new Error('CUSTOMER_CONTACT_STORE_SCOPE_MISMATCH');
      }

      const { appContact, payload } = toContactPayload(contact);
      const { error } = await client.from('customer_contacts').upsert(payload, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save customer contact: ${error.message || 'unknown Supabase error'}`);
      }

      return appContact;
    },
    async saveInquiry(inquiry) {
      assertCustomerMemorySpineWriteAllowed(approval);
      if (inquiry.customer_id && !(await customerBelongsToStore(inquiry.store_id, inquiry.customer_id))) {
        throw new Error('INQUIRY_CUSTOMER_STORE_SCOPE_MISMATCH');
      }

      const { appInquiry, payload } = toInquiryPayload(inquiry);
      const { error } = await client.from('inquiries').upsert(payload, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save inquiry: ${error.message || 'unknown Supabase error'}`);
      }

      return appInquiry;
    },
  };

  return adapter;
}
