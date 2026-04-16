import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@/app/router';

function renderRoute(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [pathname],
  });

  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })),
  );
}

describe('marketing pages', () => {
  it('renders the landing page as a teaser with a diagnosis-cinema CTA', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-landing-mode="teaser"');
    expect(html).toContain('Customer-memory revenue system');
    expect(html).toContain('공개 스토어 진단 생성');
    expect(html).toContain('FREE / PRO / VIP 보기');
    expect(html).toContain('/onboarding');
    expect(html).not.toContain('data-corridor-shell="continuous"');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('renders the onboarding page inside the same diagnosis shell', () => {
    const html = renderRoute('/onboarding');

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-diagnosis-shell="cinema"');
    expect(html).toContain('스토어 확인');
    expect(html).toContain('신호 수집');
    expect(html).toContain('고객 기억 결합');
    expect(html).toContain('실행안 도출');
    expect(html).toContain('운영 대시보드');
    expect(html).toContain('공개 스토어가 무료 acquisition 입구가 됩니다.');
    expect(html).not.toContain('data-diagnosis-dashboard-payoff="true"');
  });

  it('renders the shared UI preview page with T01 primitives', () => {
    const html = renderRoute('/dev/ui');

    expect(html).toContain('UI Preview');
    expect(html).toContain('StatCard');
    expect(html).toContain('App Launcher');
    expect(html).toContain('Insight Callout');
    expect(html).toContain('Empty State');
  });

  it('renders the admin login page without exposing a hardcoded password', () => {
    const html = renderRoute('/login');

    expect(html).toContain('Admin Access');
    expect(html).toContain('Google');
    expect(html).toContain('demo@mybizlab.ai');
    expect(html).toContain('비밀번호');
    expect(html).not.toContain('demo123');
  });

  it('keeps the pricing page reachable', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
  });

  it('renders the corrected business representative in shared legal surfaces', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('대표자: 이정민');
    expect(html).not.toContain('대표자: 이정민님');
  });
});
