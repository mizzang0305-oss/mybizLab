import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import {
  getPublicConsultation,
  listConversationMessages,
  listConversationSessions,
  listCustomerTimelineEvents,
  submitPublicConsultation,
} from '@/shared/lib/services/mvpService';

describe('public AI consultation flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('creates inquiry, conversation session/messages, visitor session, and customer timeline records', async () => {
    const snapshot = await getPublicConsultation('store_mint_bbq');
    expect(snapshot?.store.id).toBe('store_mint_bbq');

    const started = await submitPublicConsultation({
      storeId: 'store_mint_bbq',
      customerName: '상담 고객',
      phone: '010-7777-2222',
      email: 'consultation@example.com',
      marketingOptIn: true,
      message: '이번 주 금요일 6명 예약 가능 여부와 웨이팅, 대표 메뉴 추천을 먼저 알고 싶어요.',
    });

    expect(started.session.channel).toBe('ai_chat');
    expect(started.inquiry.conversation_session_id).toBe(started.session.id);
    expect(started.messages.map((message) => message.sender)).toEqual(['customer', 'assistant']);
    expect(started.visitorSessionId).toBeTruthy();

    const followedUp = await submitPublicConsultation({
      storeId: 'store_mint_bbq',
      conversationSessionId: started.session.id,
      message: '혹시 단체석이 있으면 함께 안내해 주세요.',
    });

    expect(followedUp.messages).toHaveLength(4);
    expect(followedUp.messages.at(-1)?.sender).toBe('assistant');

    const sessions = await listConversationSessions('store_mint_bbq');
    expect(sessions.some((session) => session.id === started.session.id && session.inquiry_id === started.inquiry.id)).toBe(true);

    const messages = await listConversationMessages(started.session.id);
    expect(messages).toHaveLength(4);

    const timeline = await listCustomerTimelineEvents('store_mint_bbq', started.customer?.id);
    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: 'conversation_started' }),
        expect.objectContaining({ event_type: 'conversation_message' }),
      ]),
    );

    const database = getDatabase();
    expect(
      database.visitor_sessions.some(
        (session) =>
          session.store_id === 'store_mint_bbq' &&
          session.inquiry_id === started.inquiry.id &&
          session.customer_id === started.customer?.id,
      ),
    ).toBe(true);
  });
});
