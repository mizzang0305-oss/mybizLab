import { matchRoutes } from 'react-router-dom';

import { appRoutes } from '@/app/router';

function matchedPaths(pathname: string) {
  return (matchRoutes(appRoutes, pathname) ?? []).map(({ route }) => route.path ?? (route.index ? '(index)' : '(layout)'));
}

describe('app routing', () => {
  it('keeps public marketing routes separate from store slug routes', () => {
    expect(matchedPaths('/')).toContain('/');
    expect(matchedPaths('/login')).toContain('/login');
    expect(matchedPaths('/pricing')).toContain('/pricing');
    expect(matchedPaths('/terms')).toContain('/terms');
    expect(matchedPaths('/privacy')).toContain('/privacy');
    expect(matchedPaths('/refund')).toContain('/refund');

    expect(matchedPaths('/pricing')).not.toContain('/:storeSlug');
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
  });

  it('resolves store public routes under the store slug pattern', () => {
    expect(matchedPaths('/golden-coffee')).toContain('/:storeSlug');
    expect(matchedPaths('/golden-coffee')).toContain('(index)');
    expect(matchedPaths('/golden-coffee/menu')).toContain('menu');
    expect(matchedPaths('/golden-coffee/order')).toContain('order');
  });
});
