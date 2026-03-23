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
  it('renders the landing page with the main entry links and no public route exposure', () => {
    const html = renderRoute('/');

    expect(html).toContain('AI');
    expect(html).toContain('/onboarding');
    expect(html).toContain('/pricing');
    expect(html).toContain('/login');
    expect(html).not.toContain('/:storeSlug/menu');
    expect(html).not.toContain('/:storeSlug/order');
    expect(html).not.toContain('App Explorer');
  });

  it('renders the onboarding page with pricing choices and checkout entry', () => {
    const html = renderRoute('/onboarding');

    expect(html).toContain('Starter');
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

    expect(html).toContain('Starter');
    expect(html).toContain('Pro');
    expect(html).toContain('Business');
  });
});
