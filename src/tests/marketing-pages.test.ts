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
  it('renders the landing page as one continuous diagnosis corridor with dashboard reserved for the final step', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-corridor-shell="continuous"');
    expect(html).toContain('Customer-memory revenue system');
    expect(html).toContain('공개 페이지에서 받은 신호를 고객 기억으로 묶어 다음 매출로 전환합니다');
    expect(html).toContain('01');
    expect(html).toContain('스토어 확인');
    expect(html).toContain('신호 수집');
    expect(html).toContain('고객 기억 결합');
    expect(html).toContain('실행안 도출');
    expect(html).toContain('운영 대시보드');
    expect(html).toContain('#store-check');
    expect(html).toContain('#signal-capture');
    expect(html).toContain('#memory-merge');
    expect(html).toContain('#action-plan');
    expect(html).toContain('#operations-dashboard');
    expect(html).toContain('클릭하면 같은 어두운 진단 셸을 유지한 채 스토어 시작 패널로 이어집니다.');
    expect(html).toContain('운영 대시보드는 같은 메모리 시스템에서만 마지막에 떠오릅니다');
    expect(html).toContain('FREE / PRO / VIP');
    expect(html).toContain('/onboarding');
    expect(html).toContain('/pricing');
    expect(html).toContain('/login');
    expect(html).not.toContain('data-diagnosis-dashboard="true"');
    expect(html).not.toContain('/:storeSlug/menu');
    expect(html).not.toContain('/:storeSlug/order');
    expect(html).not.toContain('App Explorer');
  });

  it('renders the onboarding page inside the same dark public shell', () => {
    const html = renderRoute('/onboarding');

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-onboarding-world="continuous"');
    expect(html).toContain('방금 본 진단 흐름을 같은 세계 안에서 스토어 시작 패널로 이어갑니다');
    expect(html).toContain('스토어 시작, 결제, 승인, 대시보드 진입은 이 아래의 온보딩 단계 패널에서 계속 진행됩니다.');
    expect(html).toContain('FREE');
    expect(html).toContain('PortOne');
    expect(html).toContain('/pricing');
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
    expect(html).toContain('미설정');
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
    expect(html).not.toContain('대표자: 이정민민');
  });
});
