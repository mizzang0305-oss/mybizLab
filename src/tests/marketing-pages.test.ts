import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@/app/router';
import { DemoPreviewModal } from '@/pages/LandingPage';
import { PersistentDiagnosisWorldProvider } from '@/shared/components/PersistentDiagnosisWorldShell';

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

function renderWithRouter(element: React.ReactElement) {
  const router = createMemoryRouter(
    [
      {
        element,
        path: '/',
      },
    ],
    {
      initialEntries: ['/'],
    },
  );

  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

function expectNoMybiCompanion(html: string) {
  expect(html).not.toContain('data-mybi-shell="active"');
  expect(html).not.toContain('data-mybi-trigger="orb-handle"');
  expect(html).not.toContain('data-mybi-world="standby"');
  expect(html).not.toContain('data-mybi-panel="open"');
  expect(html).not.toContain('title="MYBI neural companion"');
}

describe('public marketing/runtime surfaces', () => {
  it('renders Korean-first landing content with public admin fallback sections', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-landing-mode="hero-engine"');
    expect(html).toContain('data-cinematic-home="true"');
    expect(html).toContain('data-service-orbit-world="hero"');
    expect(html).toContain('data-cinematic-world="service-memory"');
    expect(html).toContain('AI 운영 플랫폼, MyBiz');
    expect(html).toContain('고객을 기억할수록 매출이 쌓이는 시스템');
    expect(html).toContain('문의·예약·웨이팅·주문을 고객 기억 축으로 연결해 재방문과 객단가를 높입니다.');
    expect(html).toContain('공개 스토어 시작하기');
    expect(html).toContain('데모 보기');
    expect(html).toContain('점주 로그인');
    expect(html).toContain('공개 스토어 / 고객 접점');
    expect(html).toContain('점주 운영 대시보드');
    expect(html).toContain('고객 기억 / 반복 매출 엔진');
    expectNoMybiCompanion(html);
  });

  it('renders working homepage navigation targets and routes', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-homepage-nav="primary"');
    expect(html).toContain('href="#services"');
    expect(html).toContain('href="#features"');
    expect(html).toContain('href="#cases"');
    expect(html).toContain('href="#resources"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain('data-demo-trigger="homepage-nav"');
    expect(html).toContain('id="services"');
    expect(html).toContain('id="features"');
    expect(html).toContain('id="cases"');
    expect(html).toContain('id="resources"');
  });

  it('mounts /onboarding without MYBI', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expectNoMybiCompanion(html);
  });

  it('renders the homepage demo preview when the demo trigger opens it', () => {
    const html = renderWithRouter(
      createElement(DemoPreviewModal, {
        onClose: () => undefined,
        open: true,
      }),
    );

    expect(html).toContain('data-demo-modal="homepage"');
    expect(html).toContain('MyBiz 데모 보기');
    expect(html).toContain('공개 스토어 보기');
    expect(html).toContain('점주 화면 미리보기');
    expect(html).toContain('AI 상담 데모');
    expect(html).toContain('닫기');
    expect(html).not.toContain('Pending');
    expect(html).not.toContain('Unknown');
  });

  it('keeps pricing reachable without mounting MYBI', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('FREE');
    expect(html).toContain('PRO');
    expect(html).toContain('VIP');
    expectNoMybiCompanion(html);
  });

  it('routes the FREE pricing CTA to onboarding instead of paid checkout', () => {
    const html = renderRoute('/pricing');

    expect(html).toContain('href="/onboarding?plan=free"');
    expect(html).toContain('무료로 시작');
    expect(html).not.toContain('data-plan="free" disabled');
  });

  it('keeps public store/form routes reachable without mounting MYBI', () => {
    const publicStoreHtml = renderRoute('/mybiz-live-cafe');
    const inquiryHtml = renderRoute('/s/20d95f47-bae6-43a2-a9c9-a190be176747/inquiry');

    expect(publicStoreHtml).not.toContain('Unexpected Application Error');
    expect(inquiryHtml).not.toContain('Unexpected Application Error');
    expectNoMybiCompanion(publicStoreHtml);
    expectNoMybiCompanion(inquiryHtml);
  });

  it('keeps active MYBI providers renderless behind the global kill switch', () => {
    const html = renderToStaticMarkup(
      createElement(
        PersistentDiagnosisWorldProvider,
        { active: true, pathname: '/' },
        createElement('main', { 'data-testid': 'provider-child' }, 'provider child'),
      ),
    );

    expect(html).toContain('provider child');
    expectNoMybiCompanion(html);
  });

  it('does not mount MYBI on protected merchant routes while auth redirects resolve', () => {
    const html = renderRoute('/dashboard');

    expectNoMybiCompanion(html);
  });

  it('clarifies the merchant login split without falling back to browser-only auth wording', () => {
    const html = renderRoute('/login');

    expect(html).toContain('가게 관리자');
    expect(html).not.toContain('localStorage');
    expectNoMybiCompanion(html);
  });
});
