import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DiagnosisCinemaShell } from '@/shared/components/DiagnosisCinemaShell';
import {
  DIAGNOSIS_CORRIDOR_LAST_INDEX,
  DIAGNOSIS_CORRIDOR_STEPS,
  clampDiagnosisCorridorStepIndex,
  getDiagnosisSceneState,
  getNextDiagnosisCorridorStepIndex,
  getPreviousDiagnosisCorridorStepIndex,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

function renderShell(stepIndex: number) {
  return renderToStaticMarkup(
    createElement(DiagnosisCinemaShell, {
      currentStepIndex: stepIndex,
      forceReducedMotion: true,
      onBack: () => {},
      onContinue: () => {},
      onNext: () => {},
    }),
  );
}

describe('diagnosis cinema v2', () => {
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
      ['문의·예약·웨이팅을', '흩어지지 않게', '같은 레일에 올립니다'],
      ['세 신호를', '하나의 고객 기억으로', '압축합니다'],
      ['지금 바로 필요한', '다음 행동만', '꺼내 보여줍니다'],
      ['기억 엔진이', '스토어를 만들고', '운영 화면으로 이어집니다'],
    ]);
  });

  it('clamps state progression inside the five-step cinema', () => {
    expect(clampDiagnosisCorridorStepIndex(-2)).toBe(0);
    expect(clampDiagnosisCorridorStepIndex(2)).toBe(2);
    expect(clampDiagnosisCorridorStepIndex(99)).toBe(DIAGNOSIS_CORRIDOR_LAST_INDEX);
    expect(getNextDiagnosisCorridorStepIndex(0)).toBe(1);
    expect(getPreviousDiagnosisCorridorStepIndex(0)).toBe(0);
  });

  it('treats the generated store and dashboard as final-step-only', () => {
    expect(getDiagnosisSceneState(3).showGeneratedStore).toBe(false);
    expect(getDiagnosisSceneState(3).showDashboardPayoff).toBe(false);
    expect(getDiagnosisSceneState(4).showGeneratedStore).toBe(true);
    expect(getDiagnosisSceneState(4).showDashboardPayoff).toBe(true);
    expect(isDiagnosisCorridorFinalStep(4)).toBe(true);
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
