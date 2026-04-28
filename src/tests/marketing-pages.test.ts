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

describe('public diagnosis surfaces', () => {
  it('renders the landing page as a fullscreen hero-world entry', () => {
    const html = renderRoute('/');

    expect(html).toContain('data-landing-mode="hero-engine"');
    expect(html).toContain('data-cinematic-home="true"');
    expect(html).toContain('data-service-orbit-world="hero"');
    expect(html).toContain('data-cinematic-world="service-memory"');
    expect(html).toContain('AI 운영 플랫폼, MyBiz');
    expect(html).toContain('매장을 이해하고,');
    expect(html).toContain('고객을 기억하고,');
    expect(html).toContain('운영을 움직이는 AI');
    expect(html).toContain('공개 스토어 시작하기');
    expect(html).toContain('데모 보기');
    expect(html).toContain('점주 로그인');
    expect(html).toContain('20,000+ 사장님이 선택');
    expect(html).toContain('99.9% 안정적 서비스');
    expect(html).toContain('24/7 AI 운영 지원');
    expect(html).toContain('공개 스토어');
    expect(html).toContain('QR 주문');
    expect(html).toContain('점주 운영 화면');
    expect(html).toContain('data-product-story-flow="connected-panels"');
    expect(html).toContain('공개 스토어 / 고객 접점');
    expect(html).toContain('점주 운영 대시보드');
    expect(html).toContain('고객 기억 / 반복 매출 엔진');
    expect(html).toContain('data-demo-trigger="homepage"');
    expectNoMybiCompanion(html);
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
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

  it('mounts /onboarding as a readable layered cinematic stage without MYBI', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-onboarding-layout="cinematic-flow"');
    expect(html).toContain('data-diagnosis-experience="cinematic"');
    expect(html).toContain('data-consultation-cinema-layout="layered-stage"');
    expect(html).toContain('data-diagnosis-left-panel="consultation"');
    expect(html).toContain('data-consultation-panel="analysis"');
    expect(html).toContain('data-consultation-story-path="center"');
    expect(html).toContain('data-connected-services-board="right"');
    expect(html).toContain('AI 분석 및 상담');
    expect(html).toContain('정보 수집');
    expect(html).toContain('현황 분석');
    expect(html).toContain('이슈 진단');
    expect(html).toContain('솔루션 제안');
    expect(html).toContain('실행 계획');
    expect(html).toContain('최근 매출이 정체되어 고민이에요.');
    expect(html).toContain('신규 유입은 증가했지만 재방문율이 낮습니다.');
    expect(html).toContain('고객 유입');
    expect(html).toContain('상담 기록');
    expect(html).toContain('매출 인사이트');
    expect(html).toContain('연결된 서비스 9개');
    expect(html).toContain('데이터 파이프라인 정상');
    expect(html).toContain('보안 상태 안전');
    expect(html).toContain('data-cinematic-auto-scene="');
    expectNoMybiCompanion(html);
    expect(html).toContain('data-mybi-anchor="onboarding-active-flow"');
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
    expect(html).toContain('FREE 시작');
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

    expect(html).not.toContain('Unexpected Application Error');
    expectNoMybiCompanion(html);
  });

  it('clarifies the merchant login split without falling back to browser-only auth wording', () => {
    const html = renderRoute('/login');

    expect(html).toContain('Admin Access');
    expect(html).toContain('profiles + store_members');
    expect(html).toContain('/pricing');
  });
});
