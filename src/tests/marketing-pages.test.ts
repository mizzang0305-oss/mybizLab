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
  it('renders the landing page at root with app explorer cards and pricing-first subscription CTA', () => {
    const html = renderRoute('/');

    expect(html).toContain('SaaS MVP for store operations');
    expect(html).toContain('App Explorer');
    expect(html).toContain('741-01-03857');
    expect(html).toContain('032-214-5757');
    expect(html).toContain('/pricing');
    expect(html).not.toContain('/login?next=/dashboard');
    expect(html).not.toContain('Admin access');
  });

  it('renders the admin login page at /login', () => {
    const html = renderRoute('/login');

    expect(html).toContain('Admin access');
    expect(html).toContain('/dashboard');
  });

  it('renders the pricing page with setup fee, checkout buttons, comparison table, and onboarding steps', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('Pricing');
    expect(html).toContain('초기 세팅비');
    expect(html).toContain('390,000원');
    expect(html).toContain('Starter');
    expect(html).toContain('Pro');
    expect(html).toContain('Business');
    expect(html).toContain('Enterprise');
    expect(html).toContain('구독 시작');
    expect(html).toContain('상담 요청');
    expect(html).toContain('포함 기능 비교');
    expect(html).toContain('서비스 도입 순서');
    expect(html).toContain('data-plan="starter"');
    expect(html).toContain('data-plan="pro"');
    expect(html).toContain('data-plan="business"');
    expect(html).not.toContain('/login?next=/dashboard');
    expect(html).toContain('032-214-5757');
  });
});
