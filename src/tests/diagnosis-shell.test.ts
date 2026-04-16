import {
  DIAGNOSIS_CORRIDOR_LAST_INDEX,
  DIAGNOSIS_CORRIDOR_STEPS,
  clampDiagnosisCorridorStepIndex,
  getDiagnosisCorridorStep,
  getNextDiagnosisCorridorStepIndex,
  getPreviousDiagnosisCorridorStepIndex,
  isDiagnosisCorridorFinalStep,
} from '@/shared/lib/diagnosisCorridor';

describe('diagnosis shell state progression', () => {
  it('uses the exact five diagnosis step labels in order', () => {
    expect(DIAGNOSIS_CORRIDOR_STEPS.map((step) => `${step.number} ${step.label}`)).toEqual([
      '01 스토어 확인',
      '02 신호 수집',
      '03 고객 기억 결합',
      '04 실행안 도출',
      '05 운영 대시보드',
    ]);
  });

  it('clamps state progression inside the five-step cinema', () => {
    expect(clampDiagnosisCorridorStepIndex(-4)).toBe(0);
    expect(clampDiagnosisCorridorStepIndex(2)).toBe(2);
    expect(clampDiagnosisCorridorStepIndex(99)).toBe(DIAGNOSIS_CORRIDOR_LAST_INDEX);
  });

  it('moves forward and backward one state at a time', () => {
    expect(getNextDiagnosisCorridorStepIndex(0)).toBe(1);
    expect(getNextDiagnosisCorridorStepIndex(DIAGNOSIS_CORRIDOR_LAST_INDEX)).toBe(DIAGNOSIS_CORRIDOR_LAST_INDEX);
    expect(getPreviousDiagnosisCorridorStepIndex(3)).toBe(2);
    expect(getPreviousDiagnosisCorridorStepIndex(0)).toBe(0);
  });

  it('treats the dashboard as final-step-only', () => {
    expect(getDiagnosisCorridorStep(4).label).toBe('운영 대시보드');
    expect(isDiagnosisCorridorFinalStep(3)).toBe(false);
    expect(isDiagnosisCorridorFinalStep(4)).toBe(true);
  });
});
