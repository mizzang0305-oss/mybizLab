import { SUBSCRIPTION_START_PATH } from './siteConfig.js';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    headlineLines: ['스토어의 바깥을', '첫 번째 신호로', '불러옵니다'],
    supportLine: '첫 입력이 들어오면 세계가 바로 반응을 시작합니다.',
  },
  {
    id: 'signal-collection',
    number: '02',
    label: '신호 수집',
    headlineLines: ['문의와 예약, 웨이팅이', '세 갈래 신호로', '갈라집니다'],
    supportLine: '현재 운영 신호를 모아 어디서 반응이 시작되는지 드러냅니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    headlineLines: ['흩어지던 반응이', '고객 기억 코어로', '강하게 모입니다'],
    supportLine: '이번 흐름의 시그니처 샷으로 기억 코어가 가장 강하게 수렴합니다.',
  },
  {
    id: 'action-extraction',
    number: '04',
    label: '실행안 도출',
    headlineLines: ['실행해야 할 액션이', '광선처럼 뽑혀 나와', '선명해집니다'],
    supportLine: '다음 액션과 운영 제안이 실시간으로 추출됩니다.',
  },
  {
    id: 'dashboard-payoff',
    number: '05',
    label: '운영 대시보드',
    headlineLines: ['스토어 쉘이 결정되고', '대시보드가 옆에 자리 잡으며', '운영 세계가 완성됩니다'],
    supportLine: '마지막에는 스토어 쉘과 대시보드가 함께 정착합니다.',
  },
] as const;

export const DIAGNOSIS_CORRIDOR_LAST_INDEX = DIAGNOSIS_CORRIDOR_STEPS.length - 1;
export const DIAGNOSIS_CORRIDOR_LINK_STATE = { corridorEntry: true } as const;

export const DIAGNOSIS_AUTOPLAY_INTRO_VEIL_MS = 420;
export const DIAGNOSIS_STEP_FLASH_MS = 220;
export const DIAGNOSIS_STEP_MORPH_MS = 980;
export const DIAGNOSIS_FINAL_CTA_DELAY_MS = 920;

export type DiagnosisCorridorStep = (typeof DIAGNOSIS_CORRIDOR_STEPS)[number];
export type DiagnosisCorridorStepId = DiagnosisCorridorStep['id'];

export function clampDiagnosisCorridorStepIndex(stepIndex: number) {
  return Math.min(DIAGNOSIS_CORRIDOR_LAST_INDEX, Math.max(0, stepIndex));
}

export function getDiagnosisCorridorStep(stepIndex: number) {
  return DIAGNOSIS_CORRIDOR_STEPS[clampDiagnosisCorridorStepIndex(stepIndex)];
}

export function getDiagnosisCorridorHeadline(stepIndex: number) {
  return getDiagnosisCorridorStep(stepIndex).headlineLines.join(' ');
}

export function getNextDiagnosisCorridorStepIndex(stepIndex: number) {
  return clampDiagnosisCorridorStepIndex(stepIndex + 1);
}

export function getPreviousDiagnosisCorridorStepIndex(stepIndex: number) {
  return clampDiagnosisCorridorStepIndex(stepIndex - 1);
}

export function isDiagnosisCorridorFinalStep(stepIndex: number) {
  return clampDiagnosisCorridorStepIndex(stepIndex) === DIAGNOSIS_CORRIDOR_LAST_INDEX;
}

export function getDiagnosisSceneState(stepIndex: number) {
  const safeStepIndex = clampDiagnosisCorridorStepIndex(stepIndex);

  return {
    safeStepIndex,
    isBranchingShot: safeStepIndex === 1,
    isDetectionShot: safeStepIndex === 0,
    isMemoryMergeShot: safeStepIndex === 2,
    isOutputShot: safeStepIndex === 3,
    isPayoffShot: safeStepIndex === 4,
    showAmbientField: true,
    showDashboardPayoff: safeStepIndex >= 4,
    showGeneratedStore: safeStepIndex >= 4,
    showMemoryCore: safeStepIndex >= 2,
    showOutputRays: safeStepIndex >= 3,
    showSignalBranches: safeStepIndex >= 1,
  };
}

export function isDiagnosisShellPath(pathname: string) {
  return pathname === '/' || pathname === SUBSCRIPTION_START_PATH;
}
