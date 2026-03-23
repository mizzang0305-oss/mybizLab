import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLocation = vi.fn();
const mockSessionState = {
  session: null as unknown,
};

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
  hasDashboardAccess: (session: { role?: string } | null | undefined) =>
    Boolean(session && ['platform_owner', 'platform_admin', 'store_owner', 'store_manager'].includes(session.role || '')),
  useAdminSessionStore: (selector: (state: { session: unknown }) => unknown) => selector(mockSessionState),
}));

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';

describe('RequireAdminAuth', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      search: '?tab=overview',
      hash: '#summary',
    });
    mockSessionState.session = null;
  });

  it('redirects unauthenticated dashboard requests to /login with the next path', () => {
    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('/login?next=%2Fdashboard%3Ftab%3Doverview%23summary');
  });

  it('allows authenticated requests to continue to the dashboard outlet', () => {
    mockSessionState.session = { email: 'admin@mybiz.ai.kr', role: 'platform_owner' };

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('protected-content');
    expect(html).not.toContain('/login');
  });

  it('redirects to login when the session exists without dashboard permission', () => {
    mockSessionState.session = { email: 'blocked@mybiz.ai.kr', role: 'viewer' };

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('/login?reason=forbidden');
  });
});
