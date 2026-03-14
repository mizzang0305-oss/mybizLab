import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@/app/router';

function renderRoute(pathname: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [pathname],
  });

  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe('marketing pages', () => {
  it('renders the landing page at root with app explorer cards and footer business info', () => {
    const html = renderRoute('/');

    expect(html).toContain('SaaS MVP for store operations');
    expect(html).toContain('App Explorer');
    expect(html).toContain('AI 점장');
    expect(html).toContain('고객관리');
    expect(html).toContain('741-01-03857');
    expect(html).toContain('032-214-5757');
    expect(html).not.toContain('Admin access');
  });

  it('renders the admin login page at /login', () => {
    const html = renderRoute('/login');

    expect(html).toContain('Admin access');
    expect(html).toContain('/dashboard');
  });

  it('renders the pricing page with setup fee, four plans, comparison table, and onboarding steps', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('Pricing');
    expect(html).toContain('초기 세팅비');
    expect(html).toContain('390,000원부터');
    expect(html).toContain('Starter');
    expect(html).toContain('Pro');
    expect(html).toContain('Business');
    expect(html).toContain('Enterprise');
    expect(html).toContain('구독 시작');
    expect(html).toContain('상담 요청');
    expect(html).toContain('앱 포함 기능 비교');
    expect(html).toContain('도입 절차');
    expect(html).toContain('10개 이상 별도 상담');
    expect(html).toContain('032-214-5757');
  });
});
