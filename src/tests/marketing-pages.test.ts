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
  it('renders the redesigned landing page with the customer-memory story and conversion path', () => {
    const html = renderRoute('/');

    expect(html).toContain('고객을 기억하는 매장 시스템');
    expect(html).toContain('문의·예약·웨이팅을');
    expect(html).toContain('한 고객 기억으로 묶어');
    expect(html).toContain('단골 매출로 바꾸세요');
    expect(html).toContain('무료 공개페이지로 유입을 받고, 문의·AI 상담·예약·웨이팅을 고객 타임라인에 연결해 다음 행동까지 추천합니다.');
    expect(html).toContain('무료 공개페이지 시작');
    expect(html).toContain('운영 데모 보기');
    expect(html).toContain('기억이 없으면, 재방문 매출도 남지 않습니다');
    expect(html).toContain('유입부터 다음 행동 추천까지, 한 흐름으로 연결됩니다');
    expect(html).toContain('FREE로 유입을 만들고, PRO와 VIP로 운영을 확장합니다');
    expect(html).toContain('공개 유입');
    expect(html).toContain('고객 타임라인');
    expect(html).toContain('/onboarding');
    expect(html).toContain('/pricing');
    expect(html).toContain('/login');
    expect(html).not.toContain('/:storeSlug/menu');
    expect(html).not.toContain('/:storeSlug/order');
    expect(html).not.toContain('App Explorer');
  });

  it('renders the onboarding page with pricing choices and checkout entry', () => {
    const html = renderRoute('/onboarding');

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
    expect(html).not.toContain('이정미');
  });
});
