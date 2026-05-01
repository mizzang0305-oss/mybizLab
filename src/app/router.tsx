import { Suspense, lazy, type ComponentType, type ElementType } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router-dom';

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';
import { RequirePlatformAdminAuth } from '@/app/guards/RequirePlatformAdminAuth';
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { PlatformAdminLayout } from '@/app/layouts/PlatformAdminLayout';
import { PublicCompanionLayout } from '@/app/layouts/PublicCompanionLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { StorePublicLayout } from '@/app/layouts/StorePublicLayout';
import { PublicConsultationPage } from '@/modules/consultation/public-page';
import { PublicInquiryPage } from '@/modules/inquiries/public-page';
import { OnboardingPage } from '@/modules/onboarding/page';
import { PublicReservationPage } from '@/modules/reservations/public-page';
import { PublicSurveyResponsePage } from '@/modules/surveys/public-response-page';
import { StoreHomePage } from '@/modules/table-order/public-home-page';
import { StoreMenuPage } from '@/modules/table-order/public-menu-page';
import { StoreOrderPage } from '@/modules/table-order/public-order-page';
import { PublicWaitingPage } from '@/modules/waiting/public-page';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { LandingPage } from '@/pages/LandingPage';
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

function routeElement(Component: ElementType, options?: { mode?: 'default' | 'public' }) {
  return (
    <RouteErrorBoundary mode={options?.mode || 'default'}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
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
const RefundPage = lazyPage(() => import('@/pages/RefundPage'), 'RefundPage');
const ReservationsPage = lazyPage(() => import('@/modules/reservations/page'), 'ReservationsPage');
const SalesPage = lazyPage(() => import('@/modules/sales/page'), 'SalesPage');
const SchedulesPage = lazyPage(() => import('@/modules/schedules/page'), 'SchedulesPage');
const StoreDetailPage = lazyPage(() => import('@/modules/stores/detail-page'), 'StoreDetailPage');
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

const PlatformAdminAnnouncementsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformAnnouncementsAdminPage');
const PlatformAdminAuditLogsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformAuditLogsAdminPage');
const PlatformAdminBannersPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformBannersAdminPage');
const PlatformAdminBoardPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformBoardAdminPage');
const PlatformAdminFeatureFlagsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformFeatureFlagsAdminPage');
const PlatformAdminHomepagePage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformHomepageAdminPage');
const PlatformAdminMediaPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformMediaAdminPage');
const PlatformAdminOverviewPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformAdminOverviewPage');
const PlatformAdminPaymentEventsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPaymentEventsAdminPage');
const PlatformAdminPaymentTestsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPaymentTestsAdminPage');
const PlatformAdminPopupsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPopupsAdminPage');
const PlatformAdminPricingPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPricingAdminPage');
const PlatformAdminProductsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformProductsAdminPage');
const PlatformAdminPromotionsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPromotionsAdminPage');
const PlatformAdminSettingsPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformSettingsAdminPage');
const PlatformAdminPreviewPage = lazyPage(() => import('@/modules/platform-admin/page'), 'PlatformPreviewAdminPage');

const PlatformPublicBoardPostPage = lazyPage(() => import('@/modules/platform-public/page'), 'PlatformPublicBoardPostPage');
const PlatformPublicUpdatesPage = lazyPage(() => import('@/modules/platform-public/page'), 'PlatformPublicUpdatesPage');

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
        path: '/billing',
        element: <Navigate replace to="/pricing" />,
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
      {
        path: '/notices',
        element: routeElement(PlatformPublicUpdatesPage),
      },
      {
        path: '/updates',
        element: routeElement(PlatformPublicUpdatesPage),
      },
      {
        path: '/updates/:slug',
        element: routeElement(PlatformPublicBoardPostPage),
      },
    ],
  },
  {
    element: <RequirePlatformAdminAuth />,
    children: [
      {
        path: '/admin',
        element: <PlatformAdminLayout />,
        children: [
          {
            index: true,
            element: routeElement(PlatformAdminOverviewPage),
          },
          {
            path: 'homepage',
            element: routeElement(PlatformAdminHomepagePage),
          },
          {
            path: 'pricing',
            element: routeElement(PlatformAdminPricingPage),
          },
          {
            path: 'products',
            element: routeElement(PlatformAdminProductsPage),
          },
          {
            path: 'promotions',
            element: routeElement(PlatformAdminPromotionsPage),
          },
          {
            path: 'announcements',
            element: routeElement(PlatformAdminAnnouncementsPage),
          },
          {
            path: 'board',
            element: routeElement(PlatformAdminBoardPage),
          },
          {
            path: 'popups',
            element: routeElement(PlatformAdminPopupsPage),
          },
          {
            path: 'banners',
            element: routeElement(PlatformAdminBannersPage),
          },
          {
            path: 'media',
            element: routeElement(PlatformAdminMediaPage),
          },
          {
            path: 'payment-tests',
            element: routeElement(PlatformAdminPaymentTestsPage),
          },
          {
            path: 'payment-events',
            element: routeElement(PlatformAdminPaymentEventsPage),
          },
          {
            path: 'feature-flags',
            element: routeElement(PlatformAdminFeatureFlagsPage),
          },
          {
            path: 'audit-logs',
            element: routeElement(PlatformAdminAuditLogsPage),
          },
          {
            path: 'settings',
            element: routeElement(PlatformAdminSettingsPage),
          },
          {
            path: 'preview',
            element: routeElement(PlatformAdminPreviewPage),
          },
        ],
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
    element: <PublicCompanionLayout />,
    children: [
      {
        path: '/s/:storeId/survey/:formId',
        element: routeElement(PublicSurveyResponsePage, { mode: 'public' }),
      },
      {
        path: '/s/:storeId/inquiry',
        element: routeElement(PublicInquiryPage, { mode: 'public' }),
      },
      {
        path: '/s/:storeId/consultation',
        element: routeElement(PublicConsultationPage, { mode: 'public' }),
      },
      {
        path: '/s/:storeId/reservation',
        element: routeElement(PublicReservationPage, { mode: 'public' }),
      },
      {
        path: '/s/:storeId/waiting',
        element: routeElement(PublicWaitingPage, { mode: 'public' }),
      },
      {
        path: '/:storeSlug',
        element: <StorePublicLayout />,
        children: [
          {
            index: true,
            element: routeElement(StoreHomePage, { mode: 'public' }),
          },
          {
            path: 'menu',
            element: routeElement(StoreMenuPage, { mode: 'public' }),
          },
          {
            path: 'order',
            element: routeElement(StoreOrderPage, { mode: 'public' }),
          },
        ],
      },
      {
        path: '/store/:storeId',
        element: <StorePublicLayout />,
        children: [
          {
            index: true,
            element: routeElement(StoreHomePage, { mode: 'public' }),
          },
          {
            path: 'menu',
            element: routeElement(StoreMenuPage, { mode: 'public' }),
          },
          {
            path: 'order',
            element: routeElement(StoreOrderPage, { mode: 'public' }),
          },
        ],
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
