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
    expect(html).toContain('data-mybi-shell="active"');
    expect(html).toContain('title="MYBI neural companion"');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('mounts /onboarding with the floating MYBI layout', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-onboarding-layout="mybi-flow"');
    expect(html).toContain('data-mybi-shell="active"');
    expect(html).toContain('data-mybi-trigger="orb-handle"');
    expect(html).toContain('data-mybi-anchor="onboarding-active-flow"');
    expect(html).toContain('data-mybi-world="standby"');
    expect(html).not.toContain('title="MYBI neural companion"');
    expect(html).not.toContain('data-diagnosis-world-panel="sticky"');
  });

  it('keeps pricing reachable while preserving MYBI', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
    expect(html).toContain('data-mybi-shell="active"');
    expect(html).toContain('data-mybi-world="standby"');
    expect(html).not.toContain('title="MYBI neural companion"');
  });

  it('clarifies the merchant login split without falling back to browser-only auth wording', () => {
    const html = renderRoute('/login');

    expect(html).toContain('Admin Access');
    expect(html).toContain('profiles + store_members');
    expect(html).toContain('/pricing');
  });
});
