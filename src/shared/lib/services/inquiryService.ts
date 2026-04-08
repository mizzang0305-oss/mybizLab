import { createId } from '@/shared/lib/ids';
import { getCustomerRecordId } from '@/shared/lib/domain/customerMemory';
import {
  inquiryOwnerUpdateSchema,
  normalizeInquiryTags,
  publicInquirySchema,
} from '@/shared/lib/inquirySchema';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import type { CanonicalMyBizRepository } from '@/shared/lib/repositories/contracts';
import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import {
  getCanonicalStorePublicPage,
  touchVisitorSession,
} from '@/shared/lib/services/publicPageService';
import { assertStoreEntitlement } from '@/shared/lib/services/storeEntitlementsService';
import type { Customer, Inquiry } from '@/shared/types/models';

function nowIso() {
  return new Date().toISOString();
}

type InquiryServiceOptions = {
  repository?: CanonicalMyBizRepository;
};

export interface PublicInquirySummary {
  totalCount: number;
  openCount: number;
  recentTags: string[];
  lastInquiryAt?: string;
}

export function buildPublicInquirySummary(inquiries: Inquiry[]): PublicInquirySummary {
  const sorted = inquiries.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
  const recentTags = normalizeInquiryTags(sorted.flatMap((inquiry) => inquiry.tags).slice(0, 8));

  return {
    totalCount: sorted.length,
    openCount: sorted.filter((inquiry) => inquiry.status === 'new' || inquiry.status === 'in_progress').length,
    recentTags,
    lastInquiryAt: sorted[0]?.created_at,
  };
}

export function buildEmptyPublicInquirySummary(): PublicInquirySummary {
  return {
    totalCount: 0,
    openCount: 0,
    recentTags: [],
  };
}

export async function getPublicInquirySummary(storeId: string, options?: InquiryServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();

  try {
    return buildPublicInquirySummary(await repository.listInquiries(storeId));
  } catch {
    return buildEmptyPublicInquirySummary();
  }
}

export async function listStoreInquiries(storeId: string) {
  await assertStoreEntitlement(storeId, 'customer_memory');
  const repository = getCanonicalMyBizRepository();
  const [inquiries, customers] = await Promise.all([repository.listInquiries(storeId), repository.listCustomers(storeId)]);

  return inquiries
    .slice()
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((inquiry) => ({
      ...inquiry,
      customer: customers.find((customer) => getCustomerRecordId(customer) === inquiry.customer_id) || null,
    }));
}

export async function updateStoreInquiry(
  storeId: string,
  inquiryId: string,
  input: {
    status: Inquiry['status'];
    tags: string[];
    memo: string;
  },
) {
  await assertStoreEntitlement(storeId, 'customer_memory');
  const repository = getCanonicalMyBizRepository();
  const parsed = inquiryOwnerUpdateSchema.parse({
    ...input,
    memo: input.memo.trim(),
    tags: normalizeInquiryTags(input.tags),
  });
  const current = (await repository.listInquiries(storeId)).find((item) => item.id === inquiryId) || null;

  if (!current) {
    throw new Error('Inquiry could not be found for this store.');
  }

  return repository.saveInquiry({
    ...current,
    memo: parsed.memo,
    status: parsed.status,
    tags: parsed.tags,
    updated_at: nowIso(),
  });
}

export async function getPublicInquiryFormSnapshot(storeId: string, options?: InquiryServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  await assertStoreEntitlement(storeId, 'public_store_page', undefined, { repository });
  const [store, page, summary] = await Promise.all([
    repository.findStoreById(storeId),
    getCanonicalStorePublicPage(storeId, { repository }),
    getPublicInquirySummary(storeId, { repository }),
  ]);

  if (!store || !page) {
    return null;
  }

  if (!page.inquiry_enabled) {
    return {
      publicPageId: page.id,
      store,
      summary,
    };
  }

  await assertStoreEntitlement(storeId, 'public_inquiry', undefined, { repository });

  return {
    publicPageId: page.id,
    store,
    summary,
  };
}

export async function submitCanonicalPublicInquiry(
  input: {
    storeId: string;
    customerName: string;
    phone: string;
    email?: string;
    category: Inquiry['category'];
    requestedVisitDate?: string;
    message: string;
    marketingOptIn: boolean;
    visitorSessionId?: string;
    visitorToken?: string;
    visitorPath?: string;
    referrer?: string;
  },
  options?: InquiryServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const parsed = publicInquirySchema.parse(input);
  const storeId = input.storeId;
  const [store, page] = await Promise.all([
    repository.findStoreById(storeId),
    getCanonicalStorePublicPage(storeId, { repository }),
  ]);

  if (!store || !page) {
    throw new Error('Inquiry form could not be found for this store.');
  }
  if (!page.inquiry_enabled) {
    throw new Error('Inquiry is not enabled for this store.');
  }

  await assertStoreEntitlement(storeId, 'public_inquiry', undefined, { repository });

  const timestamp = nowIso();
  const inquiryId = createId('inquiry');
  const conversationSessionId = createId('conversation_session');
  const visitorToken = input.visitorToken?.trim() || `public_inquiry_${Date.now()}`;
  const visitorSession = await touchVisitorSession(
    {
      channel: 'inquiry',
      firstSeenAt: input.visitorSessionId ? undefined : timestamp,
      path: input.visitorPath?.trim() || `/s/${storeId}/inquiry`,
      publicPageId: page.id,
      referrer: input.referrer?.trim(),
      sessionId: input.visitorSessionId,
      storeId,
      visitorToken,
    },
    { repository },
  );

  const memoryRecord = await upsertCustomerMemory(
    {
      email: parsed.email,
      eventType: 'inquiry_captured',
      marketingOptIn: parsed.marketingOptIn,
      metadata: {
        category: parsed.category,
        requestedVisitDate: parsed.requestedVisitDate || null,
        visitorSessionId: visitorSession.id,
      },
      name: parsed.customerName,
      occurredAt: timestamp,
      phone: parsed.phone,
      source: 'public_inquiry',
      storeId,
      summary: '공개 문의가 고객 메모리에 기록되었습니다.',
    },
    { repository },
  );
  const customerId = getCustomerRecordId(memoryRecord.customer);

  const conversationSession = await repository.saveConversationSession({
    id: conversationSessionId,
    store_id: storeId,
    customer_id: customerId,
    inquiry_id: inquiryId,
    visitor_session_id: visitorSession.id,
    channel: 'public_inquiry',
    status: 'open',
    subject: `${parsed.customerName} 문의`,
    created_at: timestamp,
    updated_at: timestamp,
    last_message_at: timestamp,
  });

  await repository.appendTimelineEvent({
    id: createId('customer_timeline'),
    store_id: storeId,
    customer_id: customerId,
    event_type: 'conversation_started',
    source: 'conversation',
    summary: '공개 문의 대화가 시작되었습니다.',
    metadata: {
      category: parsed.category,
      conversationSessionId: conversationSession.id,
      inquiryId,
      visitorSessionId: visitorSession.id,
    },
    occurred_at: timestamp,
    created_at: timestamp,
  });

  const inquiry = await repository.saveInquiry({
    id: inquiryId,
    store_id: storeId,
    customer_id: customerId,
    conversation_session_id: conversationSession.id,
    visitor_session_id: visitorSession.id,
    customer_name: parsed.customerName,
    phone: parsed.phone,
    email: parsed.email,
    category: parsed.category,
    status: 'new',
    message: parsed.message,
    tags: normalizeInquiryTags([parsed.category.replace(/_/g, ' ')]),
    memo: '',
    marketing_opt_in: parsed.marketingOptIn,
    requested_visit_date: parsed.requestedVisitDate,
    source: 'public_form',
    created_at: timestamp,
    updated_at: timestamp,
  });

  await repository.saveConversationMessage({
    id: createId('conversation_message'),
    store_id: storeId,
    conversation_session_id: conversationSession.id,
    customer_id: customerId,
    inquiry_id: inquiry.id,
    sender: 'customer',
    body: parsed.message,
    metadata: {
      category: parsed.category,
      requestedVisitDate: parsed.requestedVisitDate || null,
    },
    created_at: timestamp,
  });

  await repository.appendTimelineEvent({
    id: createId('customer_timeline'),
    store_id: storeId,
    customer_id: customerId,
    event_type: 'conversation_message',
    source: 'conversation',
    summary: '고객 문의 메시지가 customer timeline에 기록되었습니다.',
    metadata: {
      category: parsed.category,
      conversationSessionId: conversationSession.id,
      inquiryId: inquiry.id,
      message: parsed.message,
    },
    occurred_at: timestamp,
    created_at: timestamp,
  });

  await touchVisitorSession(
    {
      channel: 'inquiry',
      customerId: customerId,
      firstSeenAt: visitorSession.first_seen_at,
      inquiryId: inquiry.id,
      path: input.visitorPath?.trim() || `/s/${storeId}/inquiry`,
      publicPageId: page.id,
      referrer: input.referrer?.trim(),
      sessionId: visitorSession.id,
      storeId,
      visitorToken,
    },
    { repository },
  );

  const summary = await getPublicInquirySummary(storeId, { repository });

  return {
    customer: memoryRecord.customer,
    inquiry,
    summary,
    visitorSessionId: visitorSession.id,
  };
}
