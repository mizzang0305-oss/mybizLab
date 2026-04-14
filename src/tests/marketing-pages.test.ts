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
  it('renders the landing page with the diagnosis-flow rail and customer-memory sections', () => {
    const html = renderRoute('/');

    expect(html).toContain('고객을 기억하는 매장 시스템');
    expect(html).toContain('고객 흐름을 진단해');
    expect(html).toContain('다음 단골 매출');
    expect(html).toContain('행동을 찾으세요');
    expect(html).toContain('스토어 확인부터 운영 데이터 연결, 고객 흐름 진단, 실행안 도출까지.');
    expect(html).toContain('01');
    expect(html).toContain('스토어 확인');
    expect(html).toContain('운영 데이터 연결');
    expect(html).toContain('고객 흐름 진단');
    expect(html).toContain('실행안 도출');
    expect(html).toContain('#store-check');
    expect(html).toContain('#operations-connect');
    expect(html).toContain('#customer-flow-diagnosis');
    expect(html).toContain('#action-plan');
    expect(html).toContain('매장과 운영 문맥을 먼저 확인합니다');
    expect(html).toContain('무료 공개페이지 시작');
    expect(html).toContain('운영 데모 보기');
    expect(html).toContain('매장 문맥이 보여야, 필요한 고객 기억도 보입니다');
    expect(html).toContain('공개 유입과 운영 신호가 한 고객 흐름으로 들어옵니다');
    expect(html).toContain('고객 카드와 타임라인이 운영 병목과 재방문 신호를 보여줍니다');
    expect(html).toContain('다음 행동이 보이면, 재방문과 객단가가 함께 움직입니다');
    expect(html).toContain('FREE로 유입을 시작하고, PRO와 VIP로 운영과 재방문 매출을 확장합니다');
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
