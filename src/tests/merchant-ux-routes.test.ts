import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { BrandPage } from '@/modules/brand/page';
import { ContentMediaPage, ContentSocialPage, ContentStatusPage } from '@/modules/content/page';
import { CustomersPage } from '@/modules/customers/page';
import { DashboardPage } from '@/modules/dashboard/page';
import { OrdersPage } from '@/modules/orders/page';
import { ReservationsPage } from '@/modules/reservations/page';
import { TableOrderAdminPage } from '@/modules/table-order/admin-page';
import { WaitingPage } from '@/modules/waiting/page';
import { resetDatabase } from '@/shared/lib/mockDb';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import {
  getStoreSettings,
  getTableLiveBoard,
  listAccessibleStores,
  listConversationSessions,
  listCustomers,
  listInquiries,
  listMenu,
  listOrders,
  listReservations,
  listStoreTables,
  listWaitingEntries,
} from '@/shared/lib/services/mvpService';
import {
  createStoreMediaAsset,
  getContentReadinessDashboard,
  listSocialProviderCards,
  listSocialPublishJobs,
  listStoreMediaAssets,
} from '@/shared/lib/services/contentEngineService';
import { getStoreEntitlements } from '@/shared/lib/services/storeEntitlementsService';
import { useUiStore } from '@/shared/lib/uiStore';

const storeId = 'store_golden_coffee';

async function renderMerchantPage(element: ReactNode, prefetch?: (queryClient: QueryClient) => Promise<void>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  await queryClient.prefetchQuery({
    queryKey: queryKeys.stores,
    queryFn: listAccessibleStores,
  });

  if (prefetch) {
    await prefetch(queryClient);
  }

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, element),
    ),
  );
}

describe('merchant UX routes', () => {
  beforeEach(() => {
    resetDatabase();
    useUiStore.setState({ selectedStoreId: storeId, sidebarOpen: false });
  });

  it('renders dashboard and settings with action-driven Korean copy', async () => {
    const dashboardHtml = await renderMerchantPage(createElement(DashboardPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: [...queryKeys.dashboard(storeId), 'runtime-truth'],
        queryFn: async () => {
          const repository = getCanonicalMyBizRepository();
          const [customers, inquiries, reservations, waitingEntries, timelineEvents, publicPage, entitlements] =
            await Promise.all([
              repository.listCustomers(storeId),
              repository.listInquiries(storeId),
              repository.listReservations(storeId),
              repository.listWaitingEntries(storeId),
              repository.listCustomerTimelineEvents(storeId),
              repository.getStorePublicPage(storeId),
              getStoreEntitlements(storeId, { repository }),
            ]);

          return {
            activeWaitingCount: waitingEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'called').length,
            customersCount: customers.length,
            entitlements,
            inquiries,
            openInquiryCount: inquiries.filter((inquiry) => inquiry.status !== 'completed').length,
            publicPage,
            reservations,
            timelineEvents,
            upcomingReservationCount: reservations.filter((reservation) => reservation.status !== 'cancelled').length,
            waitingEntries,
          };
        },
      });
    });
    const settingsHtml = await renderMerchantPage(createElement(BrandPage), async (queryClient) => {
      await queryClient.prefetchQuery({ queryKey: queryKeys.brand(storeId), queryFn: () => getStoreSettings(storeId) });
    });

    expect(dashboardHtml).toContain('오늘 먼저 볼 운영 상태');
    expect(dashboardHtml).toContain('고객 기억 보기');
    expect(settingsHtml).toContain('AI 상담 버튼');
    expect(settingsHtml).toContain('고객 문의를 고객 기억으로 저장합니다.');
  });

  it('renders order and table-order screens with next action and payment clarity', async () => {
    const ordersHtml = await renderMerchantPage(createElement(OrdersPage), async (queryClient) => {
      await queryClient.prefetchQuery({ queryKey: queryKeys.orders(storeId), queryFn: () => listOrders(storeId) });
    });
    const tableOrderHtml = await renderMerchantPage(createElement(TableOrderAdminPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({ queryKey: queryKeys.storeTables(storeId), queryFn: () => listStoreTables(storeId) }),
        queryClient.prefetchQuery({ queryKey: queryKeys.menu(storeId), queryFn: () => listMenu(storeId) }),
        queryClient.prefetchQuery({ queryKey: queryKeys.tableLiveBoard(storeId), queryFn: () => getTableLiveBoard(storeId) }),
      ]);
    });

    expect(ordersHtml).toContain('다음:');
    expect(ordersHtml).toContain('결제 대기');
    expect(ordersHtml).toContain('모바일 결제 완료로 표시');
    expect(tableOrderHtml).toContain('테이블 한눈에 보기');
    expect(tableOrderHtml).toContain('결제 방식 미확인');
  });

  it('renders customer, reservation, and waiting screens with customer-memory language', async () => {
    const customersHtml = await renderMerchantPage(createElement(CustomersPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({ queryKey: queryKeys.customers(storeId), queryFn: () => listCustomers(storeId) }),
        queryClient.prefetchQuery({ queryKey: queryKeys.orders(storeId), queryFn: () => listOrders(storeId) }),
        queryClient.prefetchQuery({ queryKey: queryKeys.inquiries(storeId), queryFn: () => listInquiries(storeId) }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.conversationSessions(storeId),
          queryFn: () => listConversationSessions(storeId),
        }),
      ]);
    });
    const reservationsHtml = await renderMerchantPage(createElement(ReservationsPage), async (queryClient) => {
      await queryClient.prefetchQuery({ queryKey: queryKeys.reservations(storeId), queryFn: () => listReservations(storeId) });
    });
    const waitingHtml = await renderMerchantPage(createElement(WaitingPage), async (queryClient) => {
      await queryClient.prefetchQuery({ queryKey: queryKeys.waiting(storeId), queryFn: () => listWaitingEntries(storeId) });
    });

    expect(customersHtml).toContain('고객 기억 관리');
    expect(customersHtml).toContain('AI 상담 / 고객 기억 맥락');
    expect(customersHtml).toContain('고객 타임라인 인텔리전스');
    expect(customersHtml).toContain('이 기능은 다음 배포에서 제공됩니다.');
    expect(reservationsHtml).toContain('다음:');
    expect(waitingHtml).toContain('다음:');
  });

  it('renders YouTube social foundation with disabled connection copy and scopes', async () => {
    const socialHtml = await renderMerchantPage(createElement(ContentSocialPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.contentSocial(storeId),
          queryFn: () => listSocialProviderCards(storeId),
        }),
        queryClient.prefetchQuery({
          queryKey: [...queryKeys.contentSocial(storeId), 'jobs'],
          queryFn: () => listSocialPublishJobs(storeId),
        }),
      ]);
    });

    expect(socialHtml).toContain('YouTube 업로드 준비');
    expect(socialHtml).toContain('YouTube 영상 업로드와 자막 등록은 계정 연동과 업로드 설정 완료 후 사용할 수 있습니다.');
    expect(socialHtml).toContain('승인된 media job만 서버 adapter에서 YouTube 업로드를 실행합니다.');
    expect(socialHtml).toContain('내부 storage_path 기반 파일 handoff가 필요합니다.');
    expect(socialHtml).toContain('STT가 없으면 fake caption을 만들지 않습니다.');
    expect(socialHtml).toContain('https://www.googleapis.com/auth/youtube.upload');
    expect(socialHtml).toContain('계정 연동은 설정이 완료되면 사용할 수 있습니다.');
  });

  it('renders media STT foundation with disabled action copy', async () => {
    await createStoreMediaAsset(storeId, {
      assetType: 'video',
      durationSeconds: 20,
      status: 'ready',
      url: 'https://example.com/store-video.mp4',
    });

    const mediaHtml = await renderMerchantPage(createElement(ContentMediaPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.contentMedia(storeId, 'all'),
        queryFn: () => listStoreMediaAssets(storeId),
      });
    });

    expect(mediaHtml).toContain('STT 자막 생성 준비');
    expect(mediaHtml).toContain('음성 분석 설정이 완료되면 영상 자막과 설명 초안을 생성할 수 있습니다.');
    expect(mediaHtml).toContain('영상 자막 초안은 음성 분석 설정이 완료되면 생성할 수 있습니다.');
    expect(mediaHtml).toContain('자막 초안 생성');
  });

  it('renders content status dashboard with separate transcript and caption readiness cards', async () => {
    const statusHtml = await renderMerchantPage(createElement(ContentStatusPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.contentStatus(storeId),
        queryFn: () => getContentReadinessDashboard(storeId),
      });
    });

    expect(statusHtml).toContain('transcript ready asset');
    expect(statusHtml).toContain('caption ready asset');
    expect(statusHtml).toContain('점주 승인 필요');
    expect(statusHtml).not.toContain('transcript/caption ready');
    expect(statusHtml).not.toContain('approval_missing</p>');
  });
});
