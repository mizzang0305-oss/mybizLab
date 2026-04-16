import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    headlineLines: ['공개 스토어에', '들어온 첫 신호를', '붙잡습니다'],
    supportLine: '무료 공개 스토어에 남는 첫 흔적부터 바로 감지합니다.',
  },
  {
    id: 'signal-capture',
    number: '02',
    label: '신호 수집',
    headlineLines: ['문의·예약·웨이팅을', '같은 레일에', '올립니다'],
    supportLine: '세 입력 채널을 흩어지지 않는 한 줄로 모읍니다.',
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    headlineLines: ['세 신호를', '하나의 고객 기억으로', '압축합니다'],
    supportLine: '고객과 타임라인이 MyBiz 기억 코어로 응축됩니다.',
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    headlineLines: ['지금 필요한', '다음 행동만', '꺼냅니다'],
    supportLine: '다시 불러야 할 액션만 남겨 바로 실행하게 합니다.',
  },
  {
    id: 'operations-dashboard',
    number: '05',
    label: '운영 대시보드',
    headlineLines: ['기억 엔진이', '스토어와 운영 화면을', '만듭니다'],
    supportLine: '생성된 스토어와 운영 화면이 같은 엔진에서 솟아납니다.',
  },
] as const;

export const DIAGNOSIS_CHANNEL_LABELS = ['문의', '예약', '웨이팅'] as const;
export const DIAGNOSIS_ACTION_LABELS = ['재방문 알림', '업셀 힌트', '예약 후속'] as const;
export const DIAGNOSIS_CORRIDOR_LAST_INDEX = DIAGNOSIS_CORRIDOR_STEPS.length - 1;
export const DIAGNOSIS_CORRIDOR_LINK_STATE = { corridorEntry: true } as const;

export const DIAGNOSIS_AUTOPLAY_INTRO_VEIL_MS = 420;
export const DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS = [1400, 2000, 2800, 2000, 3000] as const;
export const DIAGNOSIS_AUTOPLAY_STEP_START_OFFSETS_MS = DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS.reduce<number[]>(
  (offsets, duration, index) => {
    if (index === 0) {
      offsets.push(0);
      return offsets;
    }

    offsets.push(offsets[index - 1] + DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[index - 1]);
    return offsets;
  },
  [],
);
export const DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS = DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS.reduce(
  (total, duration) => total + duration,
  0,
);

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

export function getDiagnosisAutoplaySnapshot(elapsedMs: number) {
  const safeElapsedMs = Math.max(0, elapsedMs);

  if (safeElapsedMs >= DIAGNOSIS_AUTOPLAY_TOTAL_DURATION_MS) {
    return {
      elapsedInStepMs: DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[DIAGNOSIS_CORRIDOR_LAST_INDEX],
      showFinalCta: true,
      status: 'complete' as const,
      stepDurationMs: DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[DIAGNOSIS_CORRIDOR_LAST_INDEX],
      stepIndex: DIAGNOSIS_CORRIDOR_LAST_INDEX,
    };
  }

  let stepStartMs = 0;

  for (let index = 0; index < DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS.length; index += 1) {
    const stepDurationMs = DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[index];
    const stepEndMs = stepStartMs + stepDurationMs;

    if (safeElapsedMs < stepEndMs) {
      return {
        elapsedInStepMs: safeElapsedMs - stepStartMs,
        showFinalCta: false,
        status: 'playing' as const,
        stepDurationMs,
        stepIndex: index,
      };
    }

    stepStartMs = stepEndMs;
  }

  return {
    elapsedInStepMs: DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[DIAGNOSIS_CORRIDOR_LAST_INDEX],
    showFinalCta: true,
    status: 'complete' as const,
    stepDurationMs: DIAGNOSIS_AUTOPLAY_STEP_DURATIONS_MS[DIAGNOSIS_CORRIDOR_LAST_INDEX],
    stepIndex: DIAGNOSIS_CORRIDOR_LAST_INDEX,
  };
}

export function getDiagnosisSceneState(stepIndex: number) {
  const safeStepIndex = clampDiagnosisCorridorStepIndex(stepIndex);

  return {
    safeStepIndex,
    showActionOutputs: safeStepIndex >= 3,
    showDashboardPayoff: safeStepIndex >= 4,
    showGeneratedStore: safeStepIndex >= 4,
    showMemoryCore: safeStepIndex >= 2,
    showSignalBranches: safeStepIndex >= 1,
    showStoreContext: safeStepIndex >= 0,
  };
}

export function isDiagnosisShellPath(pathname: string) {
  return pathname === '/' || pathname === SUBSCRIPTION_START_PATH;
}
