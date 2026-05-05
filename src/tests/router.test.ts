import { matchRoutes } from 'react-router-dom';

import { appRoutes } from '@/app/router';
import { PublicConsultationPage } from '@/modules/consultation/public-page';
import { PublicInquiryPage } from '@/modules/inquiries/public-page';
import { PublicReservationPage } from '@/modules/reservations/public-page';
import { PublicSurveyResponsePage } from '@/modules/surveys/public-response-page';
import { StoreHomePage } from '@/modules/table-order/public-home-page';
import { StoreMenuPage } from '@/modules/table-order/public-menu-page';
import { StoreOrderPage } from '@/modules/table-order/public-order-page';
import { PublicWaitingPage } from '@/modules/waiting/public-page';
import { resolveAdminNavigation } from '@/shared/lib/moduleCatalog';

function matchedPaths(pathname: string) {
  return (matchRoutes(appRoutes, pathname) ?? []).map(({ route }) => route.path ?? (route.index ? '(index)' : '(layout)'));
}

function findRoute(pathname: string, routes = appRoutes): (typeof appRoutes)[number] | undefined {
  for (const route of routes) {
    if (route.path === pathname) {
      return route;
    }

    if (route.children) {
      const match = findRoute(pathname, route.children);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
}

function unwrapRoutedComponent(pathname: string) {
  const route = findRoute(pathname);
  if (!route?.element) {
    throw new Error(`Route ${pathname} was not found.`);
  }

  const boundaryElement = route.element as {
    props: {
      children: {
        props: {
          children: {
            type: unknown;
          };
        };
      };
      mode?: string;
    };
  };

  return {
    mode: boundaryElement.props.mode,
    type: boundaryElement.props.children.props.children.type,
  };
}

describe('app routing', () => {
  it('keeps public marketing routes separate from store slug routes', () => {
    expect(matchedPaths('/')).toContain('/');
    expect(matchedPaths('/login')).toContain('/login');
    expect(matchedPaths('/admin-login')).toContain('/admin-login');
    expect(matchedPaths('/pricing')).toContain('/pricing');
    expect(matchedPaths('/billing')).toContain('/billing');
    expect(matchedPaths('/dev/ui')).not.toContain('/dev/ui');
    expect(matchedPaths('/terms')).toContain('/terms');
    expect(matchedPaths('/privacy')).toContain('/privacy');
    expect(matchedPaths('/refund')).toContain('/refund');
    expect(matchedPaths('/features')).toContain('/features');
    expect(matchedPaths('/faq')).toContain('/faq');
    expect(matchedPaths('/about')).toContain('/about');
    expect(matchedPaths('/contact')).toContain('/contact');
    expect(matchedPaths('/trust')).toContain('/trust');
    expect(matchedPaths('/cases')).toContain('/cases');
    expect(matchedPaths('/demo/dashboard')).toContain('/demo/dashboard');

    expect(matchedPaths('/pricing')).not.toContain('/:storeSlug');
    expect(matchedPaths('/billing')).not.toContain('/:storeSlug');
    expect(matchedPaths('/cases')).not.toContain('/:storeSlug');
    expect(matchedPaths('/demo/dashboard')).not.toContain('/:storeSlug');
    expect(matchedPaths('/dev/ui')).not.toContain('/:storeSlug');
    expect(matchedPaths('/terms')).not.toContain('/:storeSlug');
  });

  it('keeps the admin login page on /login only', () => {
    expect(matchedPaths('/login')).toContain('/login');
    expect(matchedPaths('/admin/login')).toContain('*');
    expect(matchedPaths('/admin/login')).not.toContain('/login');
  });

  it('resolves dashboard separately from public store pages', () => {
    expect(matchedPaths('/dashboard')).toContain('/dashboard');
    expect(matchedPaths('/dashboard')).not.toContain('/:storeSlug');
    expect(matchedPaths('/dashboard/ai-manager')).toContain('ai-manager');
    expect(matchedPaths('/dashboard/store-requests')).toContain('store-requests');
    expect(matchedPaths('/dashboard/store-requests/request_aurora')).toContain('store-requests/:requestId');
    expect(matchedPaths('/dashboard/stores')).toContain('stores');
    expect(matchedPaths('/dashboard/stores/store_golden_coffee')).toContain('stores/:storeId');
    expect(matchedPaths('/dashboard/orders')).toContain('orders');
    expect(matchedPaths('/dashboard/waiting')).toContain('waiting');
    expect(matchedPaths('/dashboard/table-order')).toContain('table-order');
    expect(matchedPaths('/dashboard/brand')).toContain('brand');
    expect(matchedPaths('/dashboard/billing')).toContain('billing');
    expect(matchedPaths('/dashboard/admin-users')).toContain('admin-users');
    expect(matchedPaths('/dashboard/system')).toContain('system');
  });

  it('resolves expanded platform admin CMS routes separately from merchant dashboard routes', () => {
    [
      '/admin/pages',
      '/admin/sections',
      '/admin/trust',
      '/admin/faq',
      '/admin/seo',
      '/admin/footer',
      '/admin/content-quality',
      '/admin/versions',
    ].forEach((pathname) => {
      expect(matchedPaths(pathname)).toContain(pathname.replace('/admin/', ''));
      expect(matchedPaths(pathname)).not.toContain('/dashboard');
    });
  });

  it('resolves the most specific admin navigation item for nested dashboard paths', () => {
    expect(resolveAdminNavigation('/dashboard')?.route).toBe('/dashboard');
    expect(resolveAdminNavigation('/dashboard/orders')?.route).toBe('/dashboard/orders');
    expect(resolveAdminNavigation('/dashboard/waiting')?.route).toBe('/dashboard/waiting');
    expect(resolveAdminNavigation('/dashboard/table-order')?.route).toBe('/dashboard/table-order');
    expect(resolveAdminNavigation('/dashboard/ai-manager')?.route).toBe('/dashboard/ai-manager');
  });

  it('resolves store public routes under the store slug pattern', () => {
    expect(matchedPaths('/golden-coffee')).toContain('/:storeSlug');
    expect(matchedPaths('/golden-coffee')).toContain('(index)');
    expect(matchedPaths('/golden-coffee/menu')).toContain('menu');
    expect(matchedPaths('/golden-coffee/order')).toContain('order');
  });

  it('resolves store public routes under the store id pattern', () => {
    expect(matchedPaths('/store/store_golden_coffee')).toContain('/store/:storeId');
    expect(matchedPaths('/store/store_golden_coffee')).toContain('(index)');
    expect(matchedPaths('/store/store_golden_coffee/menu')).toContain('menu');
    expect(matchedPaths('/store/store_golden_coffee/order')).toContain('order');
  });

  it('resolves the public survey response route by store id and form id', () => {
    expect(matchedPaths('/s/store_golden_coffee/survey/survey_menu_pulse')).toContain('/s/:storeId/survey/:formId');
  });

  it('resolves the public inquiry route by store id', () => {
    expect(matchedPaths('/s/store_golden_coffee/inquiry')).toContain('/s/:storeId/inquiry');
    expect(matchedPaths('/s/store_golden_coffee/consultation')).toContain('/s/:storeId/consultation');
  });

  it('resolves the public reservation and waiting routes by store id', () => {
    expect(matchedPaths('/s/store_golden_coffee/reservation')).toContain('/s/:storeId/reservation');
    expect(matchedPaths('/s/store_golden_coffee/waiting')).toContain('/s/:storeId/waiting');
  });

  it('keeps critical public routes in stable eager-loaded components', () => {
    expect(unwrapRoutedComponent('/s/:storeId/inquiry')).toEqual({
      mode: 'public',
      type: PublicInquiryPage,
    });
    expect(unwrapRoutedComponent('/s/:storeId/consultation')).toEqual({
      mode: 'public',
      type: PublicConsultationPage,
    });
    expect(unwrapRoutedComponent('/s/:storeId/reservation')).toEqual({
      mode: 'public',
      type: PublicReservationPage,
    });
    expect(unwrapRoutedComponent('/s/:storeId/waiting')).toEqual({
      mode: 'public',
      type: PublicWaitingPage,
    });
    expect(unwrapRoutedComponent('/s/:storeId/survey/:formId')).toEqual({
      mode: 'public',
      type: PublicSurveyResponsePage,
    });
    expect(unwrapRoutedComponent('menu')).toEqual({
      mode: 'public',
      type: StoreMenuPage,
    });
    expect(unwrapRoutedComponent('order')).toEqual({
      mode: 'public',
      type: StoreOrderPage,
    });
  });

  it('keeps the public store home route eager-loaded under both public store parents', () => {
    const publicStoreSlugRoute = appRoutes
      .flatMap((route) => route.children || [])
      .find((route) => route.path === '/:storeSlug');
    const publicStoreIdRoute = appRoutes
      .flatMap((route) => route.children || [])
      .find((route) => route.path === '/store/:storeId');

    const slugIndexType = (
      (publicStoreSlugRoute?.children?.find((route) => route.index)?.element as {
        props: { children: { props: { children: { type: unknown } } }; mode?: string };
      })
    ).props.children.props.children.type;
    const storeIdIndexType = (
      (publicStoreIdRoute?.children?.find((route) => route.index)?.element as {
        props: { children: { props: { children: { type: unknown } } }; mode?: string };
      })
    ).props.children.props.children.type;

    expect(slugIndexType).toBe(StoreHomePage);
    expect(storeIdIndexType).toBe(StoreHomePage);
  });
});
