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

    expect(html).toContain('홈페이지에서 시작해');
    expect(html).toContain('App Explorer');
    expect(html).toContain('AI 점장');
    expect(html).toContain('고객관리');
    expect(html).toContain('741-01-03857');
    expect(html).not.toContain('Admin access');
  });

  it('renders the admin login page at /login', () => {
    const html = renderRoute('/login');

    expect(html).toContain('관리자 로그인');
    expect(html).toContain('운영 콘솔 입장');
  });

  it('renders the pricing page with all three plans and subscription ctas', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('구독형 SaaS 요금제');
    expect(html).toContain('Starter');
    expect(html).toContain('Pro');
    expect(html).toContain('Business');
    expect(html).toContain('구독 시작');
  });
});
