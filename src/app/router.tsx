import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { StorePublicLayout } from '@/app/layouts/StorePublicLayout';
import { AiManagerPage } from '@/modules/ai-manager/page';
import { AiReportsPage } from '@/modules/ai-report/page';
import { BrandPage } from '@/modules/brand/page';
import { ContractsPage } from '@/modules/contracts/page';
import { CustomersPage } from '@/modules/customers/page';
import { DashboardPage } from '@/modules/dashboard/page';
import { KitchenPage } from '@/modules/kitchen/page';
import { OnboardingPage } from '@/modules/onboarding/page';
import { OrdersPage } from '@/modules/orders/page';
import { ReservationsPage } from '@/modules/reservations/page';
import { SalesPage } from '@/modules/sales/page';
import { SchedulesPage } from '@/modules/schedules/page';
import { SurveysPage } from '@/modules/surveys/page';
import { TableOrderAdminPage } from '@/modules/table-order/admin-page';
import { StoreHomePage } from '@/modules/table-order/public-home-page';
import { StoreMenuPage } from '@/modules/table-order/public-menu-page';
import { StoreOrderPage } from '@/modules/table-order/public-order-page';
import { WaitingPage } from '@/modules/waiting/page';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PricingPage } from '@/pages/PricingPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { RefundPage } from '@/pages/RefundPage';
import { TermsPage } from '@/pages/TermsPage';

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
        path: '/admin/login',
        element: <AdminLoginPage />,
      },
      {
        path: '/pricing',
        element: <PricingPage />,
      },
      {
        path: '/terms',
        element: <TermsPage />,
      },
      {
        path: '/privacy',
        element: <PrivacyPage />,
      },
      {
        path: '/refund',
        element: <RefundPage />,
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
            element: <DashboardPage />,
          },
          {
            path: 'ai-manager',
            element: <AiManagerPage />,
          },
          {
            path: 'ai-reports',
            element: <AiReportsPage />,
          },
          {
            path: 'customers',
            element: <CustomersPage />,
          },
          {
            path: 'reservations',
            element: <ReservationsPage />,
          },
          {
            path: 'schedules',
            element: <SchedulesPage />,
          },
          {
            path: 'surveys',
            element: <SurveysPage />,
          },
          {
            path: 'brand',
            element: <BrandPage />,
          },
          {
            path: 'sales',
            element: <SalesPage />,
          },
          {
            path: 'orders',
            element: <OrdersPage />,
          },
          {
            path: 'waiting',
            element: <WaitingPage />,
          },
          {
            path: 'contracts',
            element: <ContractsPage />,
          },
          {
            path: 'table-order',
            element: <TableOrderAdminPage />,
          },
          {
            path: 'kitchen',
            element: <KitchenPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/:storeSlug',
    element: <StorePublicLayout />,
    children: [
      {
        index: true,
        element: <StoreHomePage />,
      },
      {
        path: 'menu',
        element: <StoreMenuPage />,
      },
      {
        path: 'order',
        element: <StoreOrderPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
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
