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
    expect(html).toContain('data-mybi-shell="active"');
    expect(html).toContain('data-mybi-trigger="orb-handle"');
    expect(html).toContain('data-mybi-world="standby"');
    expect(html).not.toContain('title="MYBI neural companion"');
    expect(html).not.toContain('data-diagnosis-shell="cinema"');
  });

  it('mounts /onboarding with the floating MYBI layout', () => {
    let html = '';

    expect(() => {
      html = renderRoute('/onboarding');
    }).not.toThrow();

    expect(html).toContain('data-public-shell-theme="diagnosis"');
    expect(html).toContain('data-onboarding-layout="mybi-flow"');
    expect(html).toContain('data-diagnosis-experience="cinematic"');
    expect(html).toContain('data-consultation-cinema-layout="three-zone"');
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
    expect(html).toContain('data-mybi-shell="active"');
    expect(html).toContain('data-mybi-trigger="orb-handle"');
    expect(html).toContain('data-mybi-anchor="onboarding-active-flow"');
    expect(html).toContain('data-mybi-world="standby"');
    expect(html).not.toContain('title="MYBI neural companion"');
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
