import { SUBSCRIPTION_START_PATH } from './siteConfig.js';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '가게 현황 파악',
    headlineLines: ['우리 가게의 현재 신호를', 'AI가 먼저 읽고', '운영 지도를 엽니다'],
    supportLine: '공개 스토어와 첫 방문 신호를 고객 기억 입구로 정리합니다.',
  },
  {
    id: 'signal-collection',
    number: '02',
    label: '고객 신호 수집',
    headlineLines: ['문의·예약·웨이팅·주문·상담·결제가', '고객 신호로 흐르며', '한 장면 안에 모입니다'],
    supportLine: '고객 입력 채널을 따로 보지 않고 같은 운영 신호로 연결합니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    headlineLines: ['흩어진 행동이', '고객 기억 코어로', '결합됩니다'],
    supportLine: '문의, 예약, 웨이팅, 주문, 상담 맥락이 고객 타임라인으로 모입니다.',
  },
  {
    id: 'action-extraction',
    number: '04',
    label: '실행안 도출',
    headlineLines: ['기억 위에서', '오늘 실행할 액션이', '선명하게 추출됩니다'],
    supportLine: '후속 응대, 예약 확인, 주문 상태, 운영 제안을 실행 순서로 정리합니다.',
  },
  {
    id: 'dashboard-payoff',
    number: '05',
    label: '운영 대시보드 생성',
    headlineLines: ['스토어와 대시보드가', '운영 루프로 정착하고', '다음 매출 행동을 보여줍니다'],
    supportLine: '쌓인 고객 기억이 점주가 바로 보는 대시보드와 공개 스토어로 이어집니다.',
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
