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
  it('renders the landing page with the AI diagnosis value proposition and no public route exposure', () => {
    const html = renderRoute('/');

    expect(html).toContain('스토어 AI 진단');
    expect(html).toContain('소상공인 운영 AI 플랫폼');
    expect(html).toContain('스토어 AI 진단 시작');
    expect(html).toContain('AI 매장 진단 완료');
    expect(html).toContain('예약 전환율 상승');
    expect(html).not.toContain('/:storeSlug/menu');
    expect(html).not.toContain('/:storeSlug/order');
    expect(html).not.toContain('App Explorer');
  });

  it('renders the onboarding page with explicit steps and checkout entry', () => {
    const html = renderRoute('/onboarding');

    expect(html).toContain('스토어 AI 온보딩');
    expect(html).toContain('스토어 AI 진단');
    expect(html).toContain('구독 결제');
    expect(html).toContain('운영 시작');
    expect(html).toContain('PortOne 결제 진행');
  });

  it('renders the admin login page with clear Google, email, and demo options', () => {
    const html = renderRoute('/login');

    expect(html).toContain('관리자 로그인');
    expect(html).toContain('Google로 로그인');
    expect(html).toContain('이메일 로그인');
    expect(html).toContain('데모 로그인');
    expect(html).toContain('demo@mybizlab.ai');
    expect(html).toContain('demo123');
  });

  it('keeps the pricing page reachable', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('Starter');
    expect(html).toContain('Pro');
    expect(html).toContain('Business');
  });
});
