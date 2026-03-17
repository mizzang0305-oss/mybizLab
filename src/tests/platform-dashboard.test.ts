import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { AdminUsersPage } from '@/modules/admin-users/page';
import { AiReportsPage } from '@/modules/ai-report/page';
import { BillingPage } from '@/modules/billing/page';
import { CustomersPage } from '@/modules/customers/page';
import { DashboardPage } from '@/modules/dashboard/page';
import { ReservationsPage } from '@/modules/reservations/page';
import { SalesPage } from '@/modules/sales/page';
import { StoreRequestDetailPage } from '@/modules/store-requests/detail-page';
import { StoreRequestsPage } from '@/modules/store-requests/page';
import { StoreDetailPage } from '@/modules/stores/detail-page';
import { StoresPage } from '@/modules/stores/page';
import { SystemPage } from '@/modules/system/page';
import { useAdminSessionStore } from '@/shared/lib/adminSession';
import { resetDatabase } from '@/shared/lib/mockDb';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useUiStore } from '@/shared/lib/uiStore';
import { getDashboardSnapshot, listAccessibleStores, listAiReports, listCustomers, listOrders, listReservations, listSales } from '@/shared/lib/services/mvpService';
import {
  getBillingConsoleSnapshot,
  getInternalAppAccessSnapshot,
  getPlatformStoreDetail,
  getStoreRequestDetail,
  listAdminUsers,
  listStoreProvisioningLogs,
  listStoreRequests,
  listSystemStatus,
  listPlatformStores,
} from '@/shared/lib/services/platformConsoleService';

const session = {
  profileId: 'profile_platform_owner',
  email: 'ops@mybiz.ai.kr',
  fullName: 'Platform Owner',
  authenticatedAt: '2026-03-14T09:00:00.000Z',
};

async function renderDashboardRoute(
  pathname: string,
  childPath: string | undefined,
  childElement: ReactNode,
  prefetch?: (queryClient: QueryClient) => Promise<void>,
) {
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

  useAdminSessionStore.setState({ session });

  const router = createMemoryRouter(
    [
      {
        path: '/dashboard',
        element: createElement(DashboardLayout),
        children: [
          childPath
            ? {
                path: childPath,
                element: childElement,
              }
            : {
                index: true,
                element: childElement,
              },
        ],
      },
    ],
    {
      initialEntries: [pathname],
    },
  );

  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(RouterProvider, { router }),
    ),
  );

  useAdminSessionStore.setState({ session: null });

  return html;
}

describe('platform dashboard routes', () => {
  beforeEach(() => {
    resetDatabase();
    useAdminSessionStore.setState({ session: null });
    useUiStore.setState({ selectedStoreId: undefined, sidebarOpen: false });
  });

  afterEach(() => {
    useAdminSessionStore.setState({ session: null });
    useUiStore.setState({ selectedStoreId: undefined, sidebarOpen: false });
  });

  it('renders the dashboard overview', async () => {
    const html = await renderDashboardRoute('/dashboard', undefined, createElement(DashboardPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: [...queryKeys.dashboard('store_golden_coffee'), 'weekly', '', ''],
          queryFn: () => Promise.resolve(getDashboardSnapshot('store_golden_coffee', { range: 'weekly' })),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.aiReports('store_golden_coffee'),
          queryFn: () => listAiReports('store_golden_coffee'),
        }),
      ]);
    });

    expect(html).toContain('데이터 중심 운영 현황');
    expect(html).toContain('Golden Coffee');
    expect(html).toContain('href="/dashboard/orders"');
    expect(html).toContain('href="/dashboard/reservations"');
    expect(html).toContain('href="/dashboard/customers"');
    expect(html).toContain('href="/dashboard/brand"');
    expect(html).toContain('조회 기간');
    expect(html).toContain('고객 구성 분석');
    expect(html).toContain('AI 인사이트');
    expect(html).toContain('추천 액션 우선순위');
    expect(html).toContain('운영 바로가기');
  });

  it('renders the core dashboard tabs for store operations', async () => {
    const customersHtml = await renderDashboardRoute('/dashboard/customers', 'customers', createElement(CustomersPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.customers('store_golden_coffee'),
          queryFn: () => listCustomers('store_golden_coffee'),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.orders('store_golden_coffee'),
          queryFn: () => listOrders('store_golden_coffee'),
        }),
      ]);
    });

    expect(customersHtml).toContain('고객 관리');
    expect(customersHtml).toContain('현재 스토어');

    const reservationsHtml = await renderDashboardRoute(
      '/dashboard/reservations',
      'reservations',
      createElement(ReservationsPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.reservations('store_golden_coffee'),
          queryFn: () => listReservations('store_golden_coffee'),
        });
      },
    );

    expect(reservationsHtml).toContain('예약 관리');
    expect(reservationsHtml).toContain('예약 저장');

    const salesHtml = await renderDashboardRoute('/dashboard/sales', 'sales', createElement(SalesPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.sales('store_golden_coffee'),
        queryFn: () => listSales('store_golden_coffee'),
      });
    });

    expect(salesHtml).toContain('매출 분석');
    expect(salesHtml).toContain('오늘 매출');

    const reportsHtml = await renderDashboardRoute(
      '/dashboard/ai-reports',
      'ai-reports',
      createElement(AiReportsPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.aiReports('store_golden_coffee'),
          queryFn: () => listAiReports('store_golden_coffee'),
        });
      },
    );

    expect(reportsHtml).toContain('AI 운영 리포트');
    expect(reportsHtml).toContain('리포트 기록');
  });

  it('renders the store requests list and detail routes', async () => {
    const listHtml = await renderDashboardRoute(
      '/dashboard/store-requests',
      'store-requests',
      createElement(StoreRequestsPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.storeRequests,
          queryFn: listStoreRequests,
        });
      },
    );

    expect(listHtml).toContain('Store provisioning');
    expect(listHtml).toContain('Aurora Brunch');

    const detailHtml = await renderDashboardRoute(
      '/dashboard/store-requests/request_aurora_brunch',
      'store-requests/:requestId',
      createElement(StoreRequestDetailPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.storeRequestDetail('request_aurora_brunch'),
          queryFn: () => getStoreRequestDetail('request_aurora_brunch'),
        });
      },
    );

    expect(detailHtml).toContain('Request review');
    expect(detailHtml).toContain('Aurora Brunch');
  });

  it('renders the stores, billing, admin users, and system tabs', async () => {
    const storesHtml = await renderDashboardRoute('/dashboard/stores', 'stores', createElement(StoresPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.platformStores,
        queryFn: listPlatformStores,
      });
    });

    expect(storesHtml).toContain('Store operations');
    expect(storesHtml).toContain('golden-coffee');

    const storeDetailHtml = await renderDashboardRoute(
      '/dashboard/stores/store_golden_coffee',
      'stores/:storeId',
      createElement(StoreDetailPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.platformStoreDetail('store_golden_coffee'),
          queryFn: () => getPlatformStoreDetail('store_golden_coffee'),
        });
      },
    );

    expect(storeDetailHtml).toContain('Store detail');
    expect(storeDetailHtml).toContain('golden@example.com');

    const billingHtml = await renderDashboardRoute('/dashboard/billing', 'billing', createElement(BillingPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.billingRecords,
        queryFn: getBillingConsoleSnapshot,
      });
    });

    expect(billingHtml).toContain('Billing operations');
    expect(billingHtml).toContain('Mint BBQ');

    const adminUsersHtml = await renderDashboardRoute(
      '/dashboard/admin-users',
      'admin-users',
      createElement(AdminUsersPage),
      async (queryClient) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.adminUsers,
          queryFn: listAdminUsers,
        });
      },
    );

    expect(adminUsersHtml).toContain('Admin users');
    expect(adminUsersHtml).toContain('ops@mybiz.ai.kr');

    const systemHtml = await renderDashboardRoute('/dashboard/system', 'system', createElement(SystemPage), async (queryClient) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.systemStatus,
          queryFn: listSystemStatus,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.provisioningLogs,
          queryFn: () => listStoreProvisioningLogs(),
        }),
        queryClient.prefetchQuery({
          queryKey: ['internal-app-access'],
          queryFn: getInternalAppAccessSnapshot,
        }),
      ]);
    });

    expect(systemHtml).toContain('System readiness');
    expect(systemHtml).toContain('Mock Repository Active');
  });
});
