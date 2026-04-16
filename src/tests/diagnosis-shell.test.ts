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
  it('uses the rebuilt five-step editorial sequence', () => {
    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => `${step.number} ${step.label}`)).toEqual([
      '01 신호 감지',
      '02 3채널 분기',
      '03 기억 결합',
      '04 출력 정렬',
      '05 운영 착지',
    ]);

    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => step.headlineLines)).toEqual([
      ['희미한 반응이', '한 점의 빛으로', '깨어납니다'],
      ['문의와 예약, 웨이팅이', '세 갈래 결로', '갈라집니다'],
      ['흩어진 반응이', '고객 기억의 중심으로', '끌려듭니다'],
      ['필요한 액션만', '가늘고 길게', '뻗어 나갑니다'],
      ['스토어 쉘이 뜨고', '대시보드가 내려와', '멈춰 섭니다'],
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
