import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    headlineLines: ['공개 스토어에', '들어온 첫 신호를', '붙잡습니다'],
    supportLine: '입장 직후의 신호만 조용히 포착합니다.',
  },
  {
    id: 'signal-capture',
    number: '02',
    label: '신호 수집',
    headlineLines: ['문의·예약·웨이팅을', '흩어지지 않게', '같은 레일에 올립니다'],
    supportLine: '세 입력 채널을 하나의 흐름으로 묶습니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    headlineLines: ['세 신호를', '하나의 고객 기억으로', '압축합니다'],
    supportLine: 'MyBiz의 중심인 고객 기억 코어가 여기서 태어납니다.',
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    headlineLines: ['지금 바로 필요한', '다음 행동만', '꺼내 보여줍니다'],
    supportLine: '리마인드와 후속 액션만 얇게 추출합니다.',
  },
  {
    id: 'operations-dashboard',
    number: '05',
    label: '운영 대시보드',
    headlineLines: ['기억 엔진이', '스토어를 만들고', '운영 화면으로 이어집니다'],
    supportLine: '생성된 스토어와 운영 화면이 같은 엔진에서 떠오릅니다.',
  },
] as const;

export const DIAGNOSIS_CHANNEL_LABELS = ['문의', '예약', '웨이팅'] as const;
export const DIAGNOSIS_ACTION_LABELS = ['리마인드', '업셀 힌트', '예약 후속'] as const;
export const DIAGNOSIS_CORRIDOR_LAST_INDEX = DIAGNOSIS_CORRIDOR_STEPS.length - 1;
export const DIAGNOSIS_CORRIDOR_LINK_STATE = { corridorEntry: true } as const;

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
    showStoreContext: safeStepIndex >= 0,
    showSignalBranches: safeStepIndex >= 1,
    showMemoryCore: safeStepIndex >= 2,
    showActionOutputs: safeStepIndex >= 3,
    showGeneratedStore: safeStepIndex >= 4,
    showDashboardPayoff: safeStepIndex >= 4,
    safeStepIndex,
  };
}

export function isDiagnosisShellPath(pathname: string) {
  return pathname === '/' || pathname === SUBSCRIPTION_START_PATH;
}
