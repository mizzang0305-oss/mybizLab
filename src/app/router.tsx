import { Suspense, lazy, type ComponentType, type ElementType } from 'react';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { StorePublicLayout } from '@/app/layouts/StorePublicLayout';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { LandingPage } from '@/pages/LandingPage';
import { OnboardingPage } from '@/modules/onboarding/page';
import { PricingPage } from '@/pages/PricingPage';
import { UiPreviewPage } from '@/pages/UiPreviewPage';

function RouteLoadingFallback() {
  return (
    <div className="page-shell py-14 sm:py-16">
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
        페이지를 불러오는 중입니다...
      </div>
    </div>
  );
}

function lazyPage<TModule extends Record<string, unknown>>(
  load: () => Promise<TModule>,
  exportName: keyof TModule,
) {
  return lazy(async () => {
    const module = await load();

    return {
      default: module[exportName] as ComponentType<object>,
    };
  });
}

function routeElement(Component: ElementType) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Component />
    </Suspense>
  );
}

const AiManagerPage = lazyPage(() => import('@/modules/ai-manager/page'), 'AiManagerPage');
const AiReportsPage = lazyPage(() => import('@/modules/ai-report/page'), 'AiReportsPage');
const AdminUsersPage = lazyPage(() => import('@/modules/admin-users/page'), 'AdminUsersPage');
const BillingPage = lazyPage(() => import('@/modules/billing/page'), 'BillingPage');
const BrandPage = lazyPage(() => import('@/modules/brand/page'), 'BrandPage');
const ContractsPage = lazyPage(() => import('@/modules/contracts/page'), 'ContractsPage');
const CustomersPage = lazyPage(() => import('@/modules/customers/page'), 'CustomersPage');
const DashboardPage = lazyPage(() => import('@/modules/dashboard/page'), 'DashboardPage');
const KitchenPage = lazyPage(() => import('@/modules/kitchen/page'), 'KitchenPage');
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage');
const OrdersPage = lazyPage(() => import('@/modules/orders/page'), 'OrdersPage');
const PrivacyPage = lazyPage(() => import('@/pages/PrivacyPage'), 'PrivacyPage');
const PublicInquiryPage = lazyPage(() => import('@/modules/inquiries/public-page'), 'PublicInquiryPage');
const PublicSurveyResponsePage = lazyPage(
  () => import('@/modules/surveys/public-response-page'),
  'PublicSurveyResponsePage',
);
const RefundPage = lazyPage(() => import('@/pages/RefundPage'), 'RefundPage');
const ReservationsPage = lazyPage(() => import('@/modules/reservations/page'), 'ReservationsPage');
const SalesPage = lazyPage(() => import('@/modules/sales/page'), 'SalesPage');
const SchedulesPage = lazyPage(() => import('@/modules/schedules/page'), 'SchedulesPage');
const StoreDetailPage = lazyPage(() => import('@/modules/stores/detail-page'), 'StoreDetailPage');
const StoreHomePage = lazyPage(() => import('@/modules/table-order/public-home-page'), 'StoreHomePage');
const StoreMenuPage = lazyPage(() => import('@/modules/table-order/public-menu-page'), 'StoreMenuPage');
const StoreOrderPage = lazyPage(() => import('@/modules/table-order/public-order-page'), 'StoreOrderPage');
const StoreRequestDetailPage = lazyPage(
  () => import('@/modules/store-requests/detail-page'),
  'StoreRequestDetailPage',
);
const StoreRequestsPage = lazyPage(() => import('@/modules/store-requests/page'), 'StoreRequestsPage');
const StoresPage = lazyPage(() => import('@/modules/stores/page'), 'StoresPage');
const SurveysPage = lazyPage(() => import('@/modules/surveys/page'), 'SurveysPage');
const SystemPage = lazyPage(() => import('@/modules/system/page'), 'SystemPage');
const TableOrderAdminPage = lazyPage(() => import('@/modules/table-order/admin-page'), 'TableOrderAdminPage');
const TermsPage = lazyPage(() => import('@/pages/TermsPage'), 'TermsPage');
const WaitingPage = lazyPage(() => import('@/modules/waiting/page'), 'WaitingPage');

export const appRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />,
      },
      {
        path: '/onboarding',
        element: <OnboardingPage />,
      },
      {
        path: '/login',
        element: <AdminLoginPage />,
      },
      {
        path: '/pricing',
        element: <PricingPage />,
      },
      {
        path: '/dev/ui',
        element: <UiPreviewPage />,
      },
      {
        path: '/terms',
        element: routeElement(TermsPage),
      },
      {
        path: '/privacy',
        element: routeElement(PrivacyPage),
      },
      {
        path: '/refund',
        element: routeElement(RefundPage),
      },
    ],
  },
  {
    element: <RequireAdminAuth />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: routeElement(DashboardPage),
          },
          {
            path: 'store-requests',
            element: routeElement(StoreRequestsPage),
          },
          {
            path: 'store-requests/:requestId',
            element: routeElement(StoreRequestDetailPage),
          },
          {
            path: 'stores',
            element: routeElement(StoresPage),
          },
          {
            path: 'stores/:storeId',
            element: routeElement(StoreDetailPage),
          },
          {
            path: 'billing',
            element: routeElement(BillingPage),
          },
          {
            path: 'admin-users',
            element: routeElement(AdminUsersPage),
          },
          {
            path: 'system',
            element: routeElement(SystemPage),
          },
          {
            path: 'ai-manager',
            element: routeElement(AiManagerPage),
          },
          {
            path: 'ai-reports',
            element: routeElement(AiReportsPage),
          },
          {
            path: 'customers',
            element: routeElement(CustomersPage),
          },
          {
            path: 'reservations',
            element: routeElement(ReservationsPage),
          },
          {
            path: 'schedules',
            element: routeElement(SchedulesPage),
          },
          {
            path: 'surveys',
            element: routeElement(SurveysPage),
          },
          {
            path: 'brand',
            element: routeElement(BrandPage),
          },
          {
            path: 'sales',
            element: routeElement(SalesPage),
          },
          {
            path: 'orders',
            element: routeElement(OrdersPage),
          },
          {
            path: 'waiting',
            element: routeElement(WaitingPage),
          },
          {
            path: 'contracts',
            element: routeElement(ContractsPage),
          },
          {
            path: 'table-order',
            element: routeElement(TableOrderAdminPage),
          },
          {
            path: 'kitchen',
            element: routeElement(KitchenPage),
          },
        ],
      },
    ],
  },
  {
    path: '/s/:storeId/survey/:formId',
    element: routeElement(PublicSurveyResponsePage),
  },
  {
    path: '/s/:storeId/inquiry',
    element: routeElement(PublicInquiryPage),
  },
  {
    path: '/:storeSlug',
    element: <StorePublicLayout />,
    children: [
      {
        index: true,
        element: routeElement(StoreHomePage),
      },
      {
        path: 'menu',
        element: routeElement(StoreMenuPage),
      },
      {
        path: 'order',
        element: routeElement(StoreOrderPage),
      },
    ],
  },
  {
    path: '/store/:storeId',
    element: <StorePublicLayout />,
    children: [
      {
        index: true,
        element: routeElement(StoreHomePage),
      },
      {
        path: 'menu',
        element: routeElement(StoreMenuPage),
      },
      {
        path: 'order',
        element: routeElement(StoreOrderPage),
      },
    ],
  },
  {
    path: '*',
    element: routeElement(NotFoundPage),
  },
];

let router: ReturnType<typeof createBrowserRouter> | null = null;

function getRouter() {
  if (!router) {
    router = createBrowserRouter(appRoutes);
  }

  return router;
}

export function AppRouter() {
  return <RouterProvider router={getRouter()} />;
}
