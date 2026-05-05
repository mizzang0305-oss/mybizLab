import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLocation = vi.fn();
const mockSessionState = {
  isLoading: false,
  session: null as unknown,
};
const mockPlatformQueryState = {
  data: null as unknown,
  error: null as unknown,
  isError: false,
  isLoading: false,
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
  hasDashboardAccess: (session: { accessibleStoreIds?: string[]; role?: string } | null | undefined) =>
    Boolean(session && session.accessibleStoreIds?.length && ['owner', 'manager', 'staff'].includes(session.role || '')),
  useAdminAccess: () => mockSessionState,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockPlatformQueryState,
}));

import { RequireAdminAuth } from '@/app/guards/RequireAdminAuth';
import { RequirePlatformAdminAuth } from '@/app/guards/RequirePlatformAdminAuth';

describe('RequireAdminAuth', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      search: '?tab=overview',
      hash: '#summary',
    });
    mockSessionState.isLoading = false;
    mockSessionState.session = null;
  });

  it('redirects unauthenticated dashboard requests to /login with the next path', () => {
    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('/login?next=%2Fdashboard%3Ftab%3Doverview%23summary');
  });

  it('allows authenticated requests to continue to the dashboard outlet', () => {
    mockSessionState.session = { accessibleStoreIds: ['store_golden_coffee'], email: 'admin@mybiz.ai.kr', role: 'owner' };

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('protected-content');
    expect(html).not.toContain('/login');
  });

  it('redirects to login when the session exists without dashboard permission', () => {
    mockSessionState.session = { accessibleStoreIds: ['store_golden_coffee'], email: 'blocked@mybiz.ai.kr', role: 'viewer' };

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('/login?reason=forbidden');
  });

  it('shows a loading state while server membership is being validated', () => {
    mockSessionState.isLoading = true;

    const html = renderToStaticMarkup(createElement(RequireAdminAuth));

    expect(html).toContain('권한을 확인하는 중입니다');
    expect(html).not.toContain('/login');
  });
});

describe('RequirePlatformAdminAuth', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/admin',
      search: '',
      hash: '',
    });
    mockPlatformQueryState.data = null;
    mockPlatformQueryState.error = null;
    mockPlatformQueryState.isError = false;
    mockPlatformQueryState.isLoading = false;
  });

  it('redirects unauthenticated admin requests to /login with next=/admin', () => {
    mockPlatformQueryState.isError = true;
    mockPlatformQueryState.error = new Error('Authorization bearer token is required.');

    const html = renderToStaticMarkup(createElement(RequirePlatformAdminAuth));

    expect(html).toContain('/login?next=%2Fadmin');
  });

  it('allows platform_owner and platform_admin sessions without store_members access', () => {
    mockPlatformQueryState.data = {
      email: 'mybiz.lab3@gmail.com',
      profileId: '670bd8a2-80a6-43b6-bb05-f91e8418eac6',
      role: 'platform_owner',
    };

    const html = renderToStaticMarkup(createElement(RequirePlatformAdminAuth));

    expect(html).toContain('protected-content');
    expect(html).not.toContain('/login');
  });

  it('does not allow a merchant-only forbidden session into /admin', () => {
    mockPlatformQueryState.isError = true;
    mockPlatformQueryState.error = new Error('플랫폼 관리자 권한이 필요합니다.');

    const html = renderToStaticMarkup(createElement(RequirePlatformAdminAuth));

    expect(html).toContain('플랫폼 관리자 권한이 필요합니다');
    expect(html).not.toContain('protected-content');
  });
});
