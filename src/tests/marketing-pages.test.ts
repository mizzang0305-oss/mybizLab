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
    expect(html).toContain('Crystal network');
    expect(html).toContain('FREE / PRO / VIP');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('mounts /onboarding through the real router without a DiagnosisCinemaStage runtime reference error', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-diagnosis-shell="cinema"');
    expect(html).toContain('data-diagnosis-interaction="manual"');
    expect(html).toContain('data-diagnosis-skip="true"');
    expect(html).toContain('data-diagnosis-next="true"');
    expect(html).toContain('01 신호 감지');
    expect(html).not.toContain('data-diagnosis-back=');
    expect(html).not.toContain('data-diagnosis-post-cinema="true"');
    expect(html).not.toContain('data-diagnosis-pricing-ladder="true"');
  });

  it('keeps the pricing route reachable and the footer business representative correct', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
    expect(html).toContain('대표자: 이정미');
  });
});
