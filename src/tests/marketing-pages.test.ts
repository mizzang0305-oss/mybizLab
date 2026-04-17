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

describe('public diagnosis surfaces', () => {
  it('renders the landing page as a fullscreen hero-world entry', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-landing-mode="hero-engine"');
    expect(html).toContain('공개 스토어 진단 생성');
    expect(html).toContain('data-diagnosis-world-shell="active"');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('mounts /onboarding with the persistent world split layout', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-onboarding-layout="persistent-world-split"');
    expect(html).toContain('data-diagnosis-world-shell="active"');
    expect(html).toContain('data-diagnosis-world-panel="sticky"');
    expect(html).toContain('World sync');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
    expect(html).not.toContain('data-diagnosis-post-cinema="true"');
    expect(html).not.toContain('data-diagnosis-pricing-ladder="true"');
  });

  it('keeps the pricing route reachable and the footer business representative correct', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
    expect(html).toContain('대표자: 이정민');
  });
});
