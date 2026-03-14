import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { AdminUsersPage } from '@/modules/admin-users/page';
import { BillingPage } from '@/modules/billing/page';
import { DashboardPage } from '@/modules/dashboard/page';
import { StoreRequestDetailPage } from '@/modules/store-requests/detail-page';
import { StoreRequestsPage } from '@/modules/store-requests/page';
import { StoreDetailPage } from '@/modules/stores/detail-page';
import { StoresPage } from '@/modules/stores/page';
import { SystemPage } from '@/modules/system/page';
import { useAdminSessionStore } from '@/shared/lib/adminSession';
import { resetDatabase } from '@/shared/lib/mockDb';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listAccessibleStores } from '@/shared/lib/services/mvpService';
import {
  getBillingConsoleSnapshot,
  getInternalAppAccessSnapshot,
  getPlatformOverviewSnapshot,
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
  });

  afterEach(() => {
    useAdminSessionStore.setState({ session: null });
  });

  it('renders the dashboard overview', async () => {
    const html = await renderDashboardRoute('/dashboard', undefined, createElement(DashboardPage), async (queryClient) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.platformOverview,
        queryFn: getPlatformOverviewSnapshot,
      });
    });

    expect(html).toContain('Platform operations');
    expect(html).toContain('My Biz Lab');
    expect(html).toContain('Golden Coffee');
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
