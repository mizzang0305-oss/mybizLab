import { matchRoutes } from 'react-router-dom';

import { appRoutes } from '@/app/router';
import { resolveAdminNavigation } from '@/shared/lib/moduleCatalog';

function matchedPaths(pathname: string) {
  return (matchRoutes(appRoutes, pathname) ?? []).map(({ route }) => route.path ?? (route.index ? '(index)' : '(layout)'));
}

describe('app routing', () => {
  it('keeps public marketing routes separate from store slug routes', () => {
    expect(matchedPaths('/')).toContain('/');
    expect(matchedPaths('/login')).toContain('/login');
    expect(matchedPaths('/pricing')).toContain('/pricing');
    expect(matchedPaths('/billing')).toContain('/billing');
    expect(matchedPaths('/dev/ui')).toContain('/dev/ui');
    expect(matchedPaths('/terms')).toContain('/terms');
    expect(matchedPaths('/privacy')).toContain('/privacy');
    expect(matchedPaths('/refund')).toContain('/refund');

    expect(matchedPaths('/pricing')).not.toContain('/:storeSlug');
    expect(matchedPaths('/billing')).not.toContain('/:storeSlug');
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
});
