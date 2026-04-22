import { createId } from '@/shared/lib/ids';
import { publicConsultationReplySchema, publicConsultationStartSchema } from '@/shared/lib/consultationSchema';
import { getCustomerRecordId } from '@/shared/lib/domain/customerMemory';
import { normalizeInquiryTags } from '@/shared/lib/inquirySchema';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import type { CanonicalMyBizRepository } from '@/shared/lib/repositories/contracts';
import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import { getPublicInquirySummary } from '@/shared/lib/services/inquiryService';
import { getCanonicalStorePublicPage, touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { assertStoreEntitlement } from '@/shared/lib/services/storeEntitlementsService';
import type { ConversationMessage, ConversationSession, Customer, Inquiry } from '@/shared/types/models';

function nowIso() {
  return new Date().toISOString();
}

function plusMilliseconds(timestamp: string, amount: number) {
  return new Date(new Date(timestamp).getTime() + amount).toISOString();
}

type ConsultationServiceOptions = {
  repository?: CanonicalMyBizRepository;
};

type PublicConsultationSummary = Awaited<ReturnType<typeof getPublicInquirySummary>>;

function buildInquirySummary(message: string) {
  return message.trim().replace(/\s+/g, ' ').slice(0, 180);
}

function inferConsultationTags(message: string) {
  const normalized = message.toLowerCase();
  const tags = ['ai consultation'];

  if (/예약|날짜|시간|party|group|단체/.test(normalized)) {
    tags.push('reservation');
  }

  if (/웨이팅|대기|wait/.test(normalized)) {
    tags.push('waiting');
  }

  if (/메뉴|가격|order|주문/.test(normalized)) {
    tags.push('menu');
  }

  return normalizeInquiryTags(tags);
}

function buildAssistantReply(input: {
  message: string;
  storeName: string;
  openingHours?: string;
  reservationEnabled: boolean;
  waitingEnabled: boolean;
  orderEnabled: boolean;
}) {
  const suggestions: string[] = [];
  const normalized = input.message.toLowerCase();

  if ((/예약|날짜|시간|단체|group/.test(normalized) || normalized.includes('예약')) && input.reservationEnabled) {
    suggestions.push('원하시는 날짜, 시간, 인원 수를 남겨 주시면 예약 문의로 바로 이어서 확인할 수 있어요.');
  }

  if ((/웨이팅|대기|wait/.test(normalized) || normalized.includes('대기')) && input.waitingEnabled) {
    suggestions.push('방문 예정 시간이 가까우면 웨이팅 등록으로 연결해 현재 대기 흐름까지 같이 남길 수 있습니다.');
  }

  if ((/메뉴|가격|주문|order/.test(normalized) || normalized.includes('메뉴')) && input.orderEnabled) {
    suggestions.push('메뉴나 주문 관련 문의라면 원하는 메뉴와 수량, 방문 방식까지 알려 주시면 점주가 바로 확인하기 쉬워집니다.');
  }

  if (input.openingHours) {
    suggestions.push(`현재 안내된 운영 시간은 ${input.openingHours}입니다.`);
  }

  if (!suggestions.length) {
    suggestions.push('남겨 주신 내용은 점주 문의와 고객 기억 흐름에 함께 기록되고, 후속 응대가 필요한 항목부터 정리됩니다.');
    suggestions.push('가능하면 방문 목적, 원하는 일정, 인원 수나 메뉴 관심사를 한 줄 더 남겨 주세요.');
  }

  return [
    `${input.storeName} AI 상담이에요. 남겨 주신 내용은 점주가 볼 수 있는 문의와 고객 기억에 함께 연결됩니다.`,
    suggestions.slice(0, 3).join(' '),
  ].join('\n\n');
}

async function loadConsultationContext(storeId: string, repository: CanonicalMyBizRepository) {
  const [store, page] = await Promise.all([
    repository.findStoreById(storeId),
    getCanonicalStorePublicPage(storeId, { repository }),
  ]);

  if (!store || !page) {
    throw new Error('AI 상담 화면을 찾을 수 없습니다.');
  }

  if (!page.consultation_enabled) {
    throw new Error('이 매장은 현재 AI 상담이 비활성화되어 있습니다.');
  }

  await assertStoreEntitlement(storeId, 'public_store_page', undefined, { repository });

  return {
    page,
    store,
  };
}

async function loadExistingConversation(
  repository: CanonicalMyBizRepository,
  storeId: string,
  conversationSessionId: string,
) {
  const sessions = await repository.listConversationSessions(storeId);
  const session = sessions.find((entry) => entry.id === conversationSessionId) || null;
  if (!session) {
    throw new Error('이전 상담 세션을 찾을 수 없습니다.');
  }

  return session;
}

export async function getPublicConsultationSnapshot(storeId: string, options?: ConsultationServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const { page, store } = await loadConsultationContext(storeId, repository);
  const summary = await getPublicInquirySummary(storeId, { repository });

  return {
    publicPageId: page.id,
    store,
    summary,
  };
}

export async function submitPublicConsultationMessage(
  input:
    | {
        storeId: string;
        customerName: string;
        phone: string;
        email?: string;
        marketingOptIn: boolean;
        message: string;
        visitorSessionId?: string;
        visitorToken?: string;
        visitorPath?: string;
        referrer?: string;
        conversationSessionId?: undefined;
      }
    | {
        storeId: string;
        message: string;
        visitorSessionId?: string;
        visitorToken?: string;
        visitorPath?: string;
        referrer?: string;
        conversationSessionId: string;
      },
  options?: ConsultationServiceOptions,
): Promise<{
  customer: Customer | null;
  inquiry: Inquiry;
  messages: ConversationMessage[];
  session: ConversationSession;
  summary: PublicConsultationSummary;
  visitorSessionId?: string;
}> {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const { page, store } = await loadConsultationContext(input.storeId, repository);
  const timestamp = nowIso();
  const assistantTimestamp = plusMilliseconds(timestamp, 1);

  if ('conversationSessionId' in input && input.conversationSessionId) {
    const parsed = publicConsultationReplySchema.parse({
      conversationSessionId: input.conversationSessionId,
      message: input.message,
    });
    const session = await loadExistingConversation(repository, input.storeId, parsed.conversationSessionId);
    const inquiry = (await repository.listInquiries(input.storeId)).find((entry) => entry.id === session.inquiry_id) || null;
    if (!inquiry) {
      throw new Error('상담과 연결된 문의를 찾을 수 없습니다.');
    }

    const customer =
      (await repository.listCustomers(input.storeId)).find((entry) => getCustomerRecordId(entry) === session.customer_id) || null;
    const visitorSession = await touchVisitorSession(
      {
        channel: 'inquiry',
        customerId: session.customer_id,
        firstSeenAt: undefined,
        inquiryId: inquiry.id,
        path: input.visitorPath?.trim() || `/s/${input.storeId}/consultation`,
        publicPageId: page.id,
        referrer: input.referrer?.trim(),
        sessionId: input.visitorSessionId || session.visitor_session_id,
        storeId: input.storeId,
        visitorToken: input.visitorToken?.trim() || `consultation_${Date.now()}`,
      },
      { repository },
    );

    const customerMessage = await repository.saveConversationMessage({
      id: createId('conversation_message'),
      store_id: input.storeId,
      conversation_session_id: session.id,
      customer_id: session.customer_id,
      inquiry_id: inquiry.id,
      sender: 'customer',
      body: parsed.message,
      metadata: {
        path: input.visitorPath?.trim() || `/s/${input.storeId}/consultation`,
      },
      created_at: timestamp,
    });

    const assistantMessage = await repository.saveConversationMessage({
      id: createId('conversation_message'),
      store_id: input.storeId,
      conversation_session_id: session.id,
      customer_id: session.customer_id,
      inquiry_id: inquiry.id,
      sender: 'assistant',
      body: buildAssistantReply({
        message: parsed.message,
        openingHours: page.opening_hours,
        orderEnabled: page.order_entry_enabled,
        reservationEnabled: page.reservation_enabled,
        storeName: store.name,
        waitingEnabled: true,
      }),
      metadata: {
        replyType: 'follow_up',
      },
      created_at: assistantTimestamp,
    });

    const nextTags = normalizeInquiryTags([...inquiry.tags, ...inferConsultationTags(parsed.message)]);
    const nextUpdatedAt = nowIso();

    const savedInquiry = await repository.saveInquiry({
      ...inquiry,
      tags: nextTags,
      updated_at: nextUpdatedAt,
    });

    const savedSession = await repository.saveConversationSession({
      ...session,
      last_message_at: assistantMessage.created_at,
      updated_at: assistantMessage.created_at,
    });

    await repository.appendTimelineEvent({
      id: createId('customer_timeline'),
      store_id: input.storeId,
      customer_id: session.customer_id || inquiry.customer_id || '',
      event_type: 'conversation_message',
      source: 'conversation',
      summary: '고객이 AI 상담에 추가 메시지를 남겼습니다.',
      metadata: {
        conversationSessionId: session.id,
        inquiryId: inquiry.id,
        sender: 'customer',
      },
      occurred_at: customerMessage.created_at,
      created_at: customerMessage.created_at,
    });

    await repository.appendTimelineEvent({
      id: createId('customer_timeline'),
      store_id: input.storeId,
      customer_id: session.customer_id || inquiry.customer_id || '',
      event_type: 'conversation_message',
      source: 'conversation',
      summary: 'AI 상담 답변이 고객 기억에 추가되었습니다.',
      metadata: {
        conversationSessionId: session.id,
        inquiryId: inquiry.id,
        sender: 'assistant',
      },
      occurred_at: assistantMessage.created_at,
      created_at: assistantMessage.created_at,
    });

    const messages = await repository.listConversationMessages(savedSession.id);
    const summary = await getPublicInquirySummary(input.storeId, { repository });

    return {
      customer,
      inquiry: savedInquiry,
      messages,
      session: savedSession,
      summary,
      visitorSessionId: visitorSession.id,
    };
  }

  const parsed = publicConsultationStartSchema.parse(input);
  const visitorToken = input.visitorToken?.trim() || `consultation_${Date.now()}`;
  const inquiryId = createId('inquiry');
  const sessionId = createId('conversation_session');

  const visitorSession = await touchVisitorSession(
    {
      channel: 'inquiry',
      firstSeenAt: input.visitorSessionId ? undefined : timestamp,
      metadata: {
        channelDetail: 'ai_consultation',
      },
      path: input.visitorPath?.trim() || `/s/${input.storeId}/consultation`,
      publicPageId: page.id,
      referrer: input.referrer?.trim(),
      sessionId: input.visitorSessionId,
      storeId: input.storeId,
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
        channel: 'ai_consultation',
        visitorSessionId: visitorSession.id,
      },
      name: parsed.customerName,
      occurredAt: timestamp,
      phone: parsed.phone,
      source: 'public_inquiry',
      storeId: input.storeId,
      summary: '공개 AI 상담이 고객 메모리에 기록되었습니다.',
    },
    { repository },
  );
  const customerId = getCustomerRecordId(memoryRecord.customer);

  const conversationSession = await repository.saveConversationSession({
    id: sessionId,
    store_id: input.storeId,
    customer_id: customerId,
    inquiry_id: inquiryId,
    visitor_session_id: visitorSession.id,
    channel: 'ai_chat',
    status: 'open',
    subject: `${parsed.customerName} AI 상담`,
    created_at: timestamp,
    updated_at: timestamp,
    last_message_at: timestamp,
  });

  await repository.appendTimelineEvent({
    id: createId('customer_timeline'),
    store_id: input.storeId,
    customer_id: customerId,
    event_type: 'conversation_started',
    source: 'conversation',
    summary: '공개 AI 상담 세션이 시작되었습니다.',
    metadata: {
      conversationSessionId: conversationSession.id,
      inquiryId,
      visitorSessionId: visitorSession.id,
    },
    occurred_at: timestamp,
    created_at: timestamp,
  });

  const inquiry = await repository.saveInquiry({
    id: inquiryId,
    store_id: input.storeId,
    customer_id: customerId,
    conversation_session_id: conversationSession.id,
    visitor_session_id: visitorSession.id,
    customer_name: parsed.customerName,
    phone: parsed.phone,
    email: parsed.email,
    category: 'general',
    status: 'new',
    message: buildInquirySummary(parsed.message),
    tags: inferConsultationTags(parsed.message),
    memo: 'AI 상담에서 생성된 문의입니다.',
    marketing_opt_in: parsed.marketingOptIn,
    source: 'public_form',
    created_at: timestamp,
    updated_at: timestamp,
  });

  const customerMessage = await repository.saveConversationMessage({
    id: createId('conversation_message'),
    store_id: input.storeId,
    conversation_session_id: conversationSession.id,
    customer_id: customerId,
    inquiry_id: inquiry.id,
    sender: 'customer',
    body: parsed.message,
    metadata: {
      path: input.visitorPath?.trim() || `/s/${input.storeId}/consultation`,
      startedFrom: 'public_consultation',
    },
    created_at: timestamp,
  });

  const assistantMessage = await repository.saveConversationMessage({
    id: createId('conversation_message'),
    store_id: input.storeId,
    conversation_session_id: conversationSession.id,
    customer_id: customerId,
    inquiry_id: inquiry.id,
    sender: 'assistant',
    body: buildAssistantReply({
      message: parsed.message,
      openingHours: page.opening_hours,
      orderEnabled: page.order_entry_enabled,
      reservationEnabled: page.reservation_enabled,
      storeName: store.name,
      waitingEnabled: true,
    }),
    metadata: {
      replyType: 'initial',
    },
    created_at: assistantTimestamp,
  });

  await repository.appendTimelineEvent({
    id: createId('customer_timeline'),
    store_id: input.storeId,
    customer_id: customerId,
    event_type: 'conversation_message',
    source: 'conversation',
    summary: '고객이 AI 상담을 시작했습니다.',
    metadata: {
      conversationSessionId: conversationSession.id,
      inquiryId: inquiry.id,
      sender: 'customer',
    },
    occurred_at: customerMessage.created_at,
    created_at: customerMessage.created_at,
  });

  await repository.appendTimelineEvent({
    id: createId('customer_timeline'),
    store_id: input.storeId,
    customer_id: customerId,
    event_type: 'conversation_message',
    source: 'conversation',
    summary: 'AI 상담 첫 답변이 고객 기억에 추가되었습니다.',
    metadata: {
      conversationSessionId: conversationSession.id,
      inquiryId: inquiry.id,
      sender: 'assistant',
    },
    occurred_at: assistantMessage.created_at,
    created_at: assistantMessage.created_at,
  });

  await touchVisitorSession(
    {
      channel: 'inquiry',
      customerId,
      firstSeenAt: visitorSession.first_seen_at,
      inquiryId: inquiry.id,
      metadata: {
        channelDetail: 'ai_consultation',
      },
      path: input.visitorPath?.trim() || `/s/${input.storeId}/consultation`,
      publicPageId: page.id,
      referrer: input.referrer?.trim(),
      sessionId: visitorSession.id,
      storeId: input.storeId,
      visitorToken,
    },
    { repository },
  );

  const messages = await repository.listConversationMessages(conversationSession.id);
  const summary = await getPublicInquirySummary(input.storeId, { repository });

  return {
    customer: memoryRecord.customer,
    inquiry,
    messages,
    session: conversationSession,
    summary,
    visitorSessionId: visitorSession.id,
  };
}
