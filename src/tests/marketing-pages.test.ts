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
  it('renders the landing page as a teaser-only dark entry', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-landing-mode="teaser"');
    expect(html).toContain('공개 스토어 진단 생성');
    expect(html).toContain('FREE / PRO / VIP 보기');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('renders onboarding as an autoplay diagnosis cinema with no wizard controls', () => {
    const html = renderRoute('/onboarding');

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-diagnosis-shell="cinema"');
    expect(html).toContain('data-diagnosis-autoplay="true"');
    expect(html).toContain('data-diagnosis-autoplay-state="playing"');
    expect(html).toContain('data-diagnosis-skip="true"');
    expect(html).toContain('01 스토어 확인');
    expect(html).not.toContain('data-diagnosis-back=');
    expect(html).not.toContain('data-diagnosis-next=');
    expect(html).not.toContain('data-diagnosis-post-cinema="true"');
    expect(html).not.toContain('data-diagnosis-pricing-ladder="true"');
    expect(html).not.toContain('data-diagnosis-store-reveal="true"');
    expect(html).not.toContain('data-diagnosis-dashboard-payoff="true"');
  });

  it('keeps the pricing route reachable and the footer business representative correct', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
    expect(html).toContain('대표자: 이정미');
  });
});
