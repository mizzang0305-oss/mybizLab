import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'signal-detection',
    number: '01',
    label: '신호 감지',
    headlineLines: ['희미한 반응이', '한 점의 빛으로', '깨어납니다'],
    supportLine: '가장 약한 신호부터 밝힙니다.',
  },
  {
    id: 'three-channel-branch',
    number: '02',
    label: '3채널 분기',
    headlineLines: ['문의와 예약, 웨이팅이', '세 갈래 결로', '갈라집니다'],
    supportLine: '채널별 흐름만 남겨 정렬합니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '기억 결합',
    headlineLines: ['흩어진 반응이', '고객 기억의 중심으로', '끌려듭니다'],
    supportLine: '가장 강한 장면을 중심에 고정합니다.',
  },
  {
    id: 'output-rays',
    number: '04',
    label: '출력 정렬',
    headlineLines: ['필요한 액션만', '가늘고 길게', '뻗어 나갑니다'],
    supportLine: '출력은 조용하고 정확하게 남깁니다.',
  },
  {
    id: 'store-dashboard-payoff',
    number: '05',
    label: '운영 착지',
    headlineLines: ['스토어 쉘이 뜨고', '대시보드가 내려와', '멈춰 섭니다'],
    supportLine: '스토어가 먼저, 대시보드가 다음입니다.',
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
