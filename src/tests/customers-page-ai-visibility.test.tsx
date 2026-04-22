import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomersPage } from '@/modules/customers/page';
import { resetDatabase } from '@/shared/lib/mockDb';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useUiStore } from '@/shared/lib/uiStore';
import {
  listAccessibleStores,
  listConversationMessages,
  listConversationSessions,
  listCustomerTimelineEvents,
  listCustomers,
  listInquiries,
  listOrders,
  submitPublicConsultation,
} from '@/shared/lib/services/mvpService';

describe('customers page AI consultation visibility', () => {
  beforeEach(() => {
    resetDatabase();
    useUiStore.setState({ selectedStoreId: 'store_mint_bbq', sidebarOpen: false });
  });

  it('renders AI consultation context alongside inquiry and customer memory', async () => {
    const consultation = await submitPublicConsultation({
      storeId: 'store_mint_bbq',
      customerName: '대화 고객',
      phone: '010-2222-3333',
      marketingOptIn: true,
      message: '토요일 4명 예약과 대표 메뉴 추천을 함께 상담받고 싶어요.',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    await Promise.all([
      queryClient.prefetchQuery({ queryKey: queryKeys.stores, queryFn: listAccessibleStores }),
      queryClient.prefetchQuery({ queryKey: queryKeys.customers('store_mint_bbq'), queryFn: () => listCustomers('store_mint_bbq') }),
      queryClient.prefetchQuery({ queryKey: queryKeys.orders('store_mint_bbq'), queryFn: () => listOrders('store_mint_bbq') }),
      queryClient.prefetchQuery({ queryKey: queryKeys.inquiries('store_mint_bbq'), queryFn: () => listInquiries('store_mint_bbq') }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.conversationSessions('store_mint_bbq'),
        queryFn: () => listConversationSessions('store_mint_bbq'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.conversationMessages(consultation.session.id),
        queryFn: () => listConversationMessages(consultation.session.id),
      }),
      queryClient.prefetchQuery({
        queryKey: [...queryKeys.customers('store_mint_bbq'), 'timeline', consultation.customer?.id || ''],
        queryFn: () => listCustomerTimelineEvents('store_mint_bbq', consultation.customer?.id),
      }),
    ]);

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(CustomersPage),
      ),
    );

    expect(html).toContain('AI 상담 / 고객 기억 맥락');
    expect(html).toContain('AI 상담');
    expect(html).toContain('대화 고객');
    expect(html).toContain('토요일 4명 예약과 대표 메뉴 추천');
  });
});
