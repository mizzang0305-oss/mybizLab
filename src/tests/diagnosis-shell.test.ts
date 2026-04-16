import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DiagnosisCinemaShell } from '@/shared/components/DiagnosisCinemaShell';
import {
  DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS,
  DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS,
  DIAGNOSIS_CORRIDOR_STEPS,
  getDiagnosisAutoplaySnapshot,
  getDiagnosisSceneState,
} from '@/shared/lib/diagnosisCorridor';

function renderShell({
  showEntryTransition = false,
  startCompleted = false,
}: {
  showEntryTransition?: boolean;
  startCompleted?: boolean;
} = {}) {
  return renderToStaticMarkup(
    createElement(DiagnosisCinemaShell, {
      forceReducedMotion: true,
      onContinue: () => {},
      onSkip: () => {},
      showEntryTransition,
      startCompleted,
    }),
  );
}

describe('diagnosis cinema autoplay shell', () => {
  it('uses the exact five diagnosis step labels and headlines', () => {
    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => `${step.number} ${step.label}`)).toEqual([
      '01 스토어 확인',
      '02 신호 수집',
      '03 고객 기억 결합',
      '04 실행안 도출',
      '05 운영 대시보드',
    ]);

    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => step.headlineLines)).toEqual([
      ['공개 스토어에', '들어온 첫 신호를', '붙잡습니다'],
      ['문의·예약·웨이팅을', '같은 레일에', '올립니다'],
      ['세 신호를', '하나의 고객 기억으로', '압축합니다'],
      ['지금 필요한', '다음 행동만', '꺼냅니다'],
      ['기억 엔진이', '스토어와 운영 화면을', '만듭니다'],
    ]);
  });

  it('uses the requested autoplay timeline and freezes only after step 05', () => {
    expect(DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS).toEqual([1400, 2000, 2800, 2000, 3000]);

    expect(getDiagnosisAutoplaySnapshot(0)).toMatchObject({ status: 'playing', stepIndex: 0, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(1399)).toMatchObject({ status: 'playing', stepIndex: 0, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(1400)).toMatchObject({ status: 'playing', stepIndex: 1, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(3399)).toMatchObject({ status: 'playing', stepIndex: 1, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(3400)).toMatchObject({ status: 'playing', stepIndex: 2, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(6199)).toMatchObject({ status: 'playing', stepIndex: 2, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(6200)).toMatchObject({ status: 'playing', stepIndex: 3, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(8199)).toMatchObject({ status: 'playing', stepIndex: 3, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(8200)).toMatchObject({ status: 'playing', stepIndex: 4, showFinalCta: false });
    expect(getDiagnosisAutoplaySnapshot(DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS - 1)).toMatchObject({
      status: 'playing',
      stepIndex: 4,
      showFinalCta: false,
    });
    expect(getDiagnosisAutoplaySnapshot(DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS)).toMatchObject({
      status: 'complete',
      stepIndex: 4,
      showFinalCta: true,
    });
  });

  it('removes previous and next controls from the visible shell', () => {
    const html = renderShell();

    expect(html).toContain('data-diagnosis-shell="cinema"');
    expect(html).toContain('data-diagnosis-autoplay="true"');
    expect(html).toContain('data-diagnosis-autoplay-state="playing"');
    expect(html).toContain('data-diagnosis-render-mode="reduced"');
    expect(html).toContain('data-diagnosis-skip="true"');
    expect(html).not.toContain('data-diagnosis-back=');
    expect(html).not.toContain('data-diagnosis-next=');
    expect(html).not.toContain('data-diagnosis-continue=');
  });

  it('keeps payoff elements and the final CTA locked to the completed final stage', () => {
    const initialHtml = renderShell();
    const completedHtml = renderShell({ startCompleted: true });

    expect(getDiagnosisSceneState(3).showGeneratedStore).toBe(false);
    expect(getDiagnosisSceneState(3).showDashboardPayoff).toBe(false);
    expect(getDiagnosisSceneState(4).showGeneratedStore).toBe(true);
    expect(getDiagnosisSceneState(4).showDashboardPayoff).toBe(true);

    expect(initialHtml).not.toContain('data-diagnosis-store-reveal="true"');
    expect(initialHtml).not.toContain('data-diagnosis-dashboard-payoff="true"');
    expect(initialHtml).not.toContain('data-diagnosis-final-cta="true"');
    expect(initialHtml).not.toContain('data-diagnosis-replay="true"');

    expect(completedHtml).toContain('data-diagnosis-store-reveal="true"');
    expect(completedHtml).toContain('data-diagnosis-dashboard-payoff="true"');
    expect(completedHtml).toContain('data-diagnosis-final-cta="true"');
    expect(completedHtml).toContain('data-diagnosis-replay="true"');
  });

  it('renders the reduced-motion fallback with final payoff hidden until step 05', () => {
    const initialHtml = renderShell(0);
    const finalHtml = renderShell(4);

    expect(initialHtml).toContain('data-diagnosis-shell="cinema"');
    expect(initialHtml).toContain('data-diagnosis-render-mode="reduced"');
    expect(initialHtml).not.toContain('data-diagnosis-store-reveal="true"');
    expect(initialHtml).not.toContain('data-diagnosis-dashboard-payoff="true"');

    expect(finalHtml).toContain('data-diagnosis-store-reveal="true"');
    expect(finalHtml).toContain('data-diagnosis-dashboard-payoff="true"');
  });
});
