import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CinematicServiceWorld } from '@/shared/components/CinematicServiceWorld';
import {
  CINEMATIC_CHANNEL_LABELS,
  CINEMATIC_SCENES,
  getCinematicScene,
  getCinematicSceneForDiagnosisStep,
} from '@/shared/lib/cinematicScenes';

describe('cinematic scene model', () => {
  it('keeps the five-step diagnosis story Korean-first and product-truth aligned', () => {
    expect(CINEMATIC_SCENES.map((scene) => scene.label)).toEqual([
      '가게 현황 파악',
      '고객 신호 수집',
      '고객 기억 결합',
      '실행안 도출',
      '운영 대시보드 생성',
    ]);

    expect(CINEMATIC_CHANNEL_LABELS).toEqual(['문의', '예약', '웨이팅', '주문', '상담', '결제']);
    expect(CINEMATIC_SCENES[2].canonicalEntities).toEqual(['customers', 'customer_timeline_events']);
    expect(CINEMATIC_SCENES[4].actionCaption).toContain('대시보드');
  });

  it('maps route and diagnosis step state to a stable visual scene', () => {
    expect(getCinematicScene(0).id).toBe('store-scan');
    expect(getCinematicScene(99).id).toBe('operations-dashboard');
    expect(getCinematicSceneForDiagnosisStep('diagnosis', false).id).toBe('store-scan');
    expect(getCinematicSceneForDiagnosisStep('diagnosis', true).id).toBe('customer-signals');
    expect(getCinematicSceneForDiagnosisStep('request', true).id).toBe('action-extraction');
    expect(getCinematicSceneForDiagnosisStep('payment', true).id).toBe('operations-dashboard');
  });

  it('renders the web-native animated world with a reduced-motion fallback', () => {
    const html = renderToStaticMarkup(
      createElement(CinematicServiceWorld, { forceReducedMotion: true, stepIndex: 2 }),
    );

    expect(html).toContain('data-cinematic-world="service-memory"');
    expect(html).toContain('data-cinematic-scene="memory-core"');
    expect(html).toContain('data-reduced-motion="true"');
    expect(html).toContain('고객 기억 결합');
    expect(html).toContain('문의');
    expect(html).toContain('주문');
  });
});
