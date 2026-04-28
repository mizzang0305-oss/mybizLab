import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DiagnosisCinemaShell } from '@/shared/components/DiagnosisCinemaShell';
import {
  DIAGNOSIS_CORRIDOR_STEPS,
  DIAGNOSIS_FINAL_CTA_DELAY_MS,
  DIAGNOSIS_STEP_FLASH_MS,
  DIAGNOSIS_STEP_MORPH_MS,
  getDiagnosisSceneState,
  getNextDiagnosisCorridorStepIndex,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

function renderShell({ startCompleted = false }: { startCompleted?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(DiagnosisCinemaShell, {
      forceReducedMotion: true,
      onContinue: () => {},
      onSkip: () => {},
      startCompleted,
    }),
  );
}

describe('diagnosis cinema manual shell', () => {
  it('uses the new five-step synced world sequence', () => {
    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => `${step.number} ${step.label}`)).toEqual([
      '01 가게 현황 파악',
      '02 고객 신호 수집',
      '03 고객 기억 결합',
      '04 실행안 도출',
      '05 운영 대시보드 생성',
    ]);

    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => step.headlineLines)).toEqual([
      ['우리 가게의 현재 신호를', 'AI가 먼저 읽고', '운영 지도를 엽니다'],
      ['문의·예약·웨이팅·주문·상담·결제가', '고객 신호로 흐르며', '한 장면 안에 모입니다'],
      ['흩어진 행동이', '고객 기억 코어로', '결합됩니다'],
      ['기억 위에서', '오늘 실행할 액션이', '선명하게 추출됩니다'],
      ['스토어와 대시보드가', '운영 루프로 정착하고', '다음 매출 행동을 보여줍니다'],
    ]);
  });

  it('uses click-driven morph timings instead of autoplay sequencing', () => {
    expect(DIAGNOSIS_STEP_FLASH_MS).toBe(220);
    expect(DIAGNOSIS_STEP_MORPH_MS).toBe(980);
    expect(DIAGNOSIS_FINAL_CTA_DELAY_MS).toBe(920);

    expect(getNextDiagnosisCorridorStepIndex(0)).toBe(1);
    expect(getNextDiagnosisCorridorStepIndex(3)).toBe(4);
    expect(getNextDiagnosisCorridorStepIndex(4)).toBe(4);
    expect(isDiagnosisCorridorFinalStep(4)).toBe(true);
    expect(isDiagnosisCorridorFinalStep(3)).toBe(false);
  });

  it('renders a minimal manual-control shell before the payoff', () => {
    const html = renderShell();

    expect(html).toContain('data-diagnosis-shell="cinema"');
    expect(html).toContain('data-diagnosis-interaction="manual"');
    expect(html).toContain('data-diagnosis-render-mode="reduced"');
    expect(html).toContain('data-diagnosis-skip="true"');
    expect(html).toContain('data-diagnosis-next="true"');
    expect(html).not.toContain('data-diagnosis-back=');
    expect(html).not.toContain('data-diagnosis-replay=');
    expect(html).not.toContain('data-diagnosis-final-cta="true"');
  });

  it('keeps store and dashboard payoff locked to step 05', () => {
    const initialHtml = renderShell();
    const completedHtml = renderShell({ startCompleted: true });

    expect(getDiagnosisSceneState(3).showGeneratedStore).toBe(false);
    expect(getDiagnosisSceneState(3).showDashboardPayoff).toBe(false);
    expect(getDiagnosisSceneState(4).showGeneratedStore).toBe(true);
    expect(getDiagnosisSceneState(4).showDashboardPayoff).toBe(true);

    expect(initialHtml).not.toContain('data-diagnosis-store-reveal="true"');
    expect(initialHtml).not.toContain('data-diagnosis-dashboard-payoff="true"');
    expect(initialHtml).not.toContain('data-diagnosis-final-cta="true"');

    expect(completedHtml).toContain('data-diagnosis-store-reveal="true"');
    expect(completedHtml).toContain('data-diagnosis-dashboard-payoff="true"');
    expect(completedHtml).toContain('data-diagnosis-final-cta="true"');
  });
});
