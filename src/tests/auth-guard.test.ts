import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLocation = vi.fn();
const mockUseAdminSessionStore = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => createElement('div', { 'data-redirect-to': to }, 'redirect'),
    Outlet: () => createElement('div', null, 'protected-content'),
    useLocation: () => mockUseLocation(),
  };
});

vi.mock('@/shared/lib/adminSession', () => ({
  useAdminSessionStore: (selector: (state: { session: unknown }) => unknown) => mockUseAdminSessionStore(selector),
}));

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';

describe('RequireAdminAuth', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      search: '?tab=overview',
      hash: '#summary',
    });
    mockUseAdminSessionStore.mockImplementation((selector: (state: { session: unknown }) => unknown) =>
      selector({ session: null }),
    );
  });

  it('redirects unauthenticated dashboard requests to /login with the next path', () => {
    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('/login?next=%2Fdashboard%3Ftab%3Doverview%23summary');
  });

  it('allows authenticated requests to continue to the dashboard outlet', () => {
    mockUseAdminSessionStore.mockImplementation((selector: (state: { session: unknown }) => unknown) =>
      selector({ session: { email: 'admin@mybiz.ai.kr' } }),
    );

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('protected-content');
    expect(html).not.toContain('/login');
  });
});
