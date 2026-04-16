import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    title: '공개 스토어 진입 직후의 첫 신호를 같은 화면 안에서 포착합니다.',
    detail: '무료 공개 페이지로 들어온 흐름을 끊지 않고, 어떤 스토어인지 확인하는 첫 진단 단계부터 같은 세계 안에서 시작합니다.',
    highlights: ['공개 페이지 유입', '스토어 문맥 확인', '첫 방문 신호 기록'],
  },
  {
    id: 'signal-capture',
    number: '02',
    label: '신호 수집',
    title: '문의, 예약, 웨이팅 신호가 갈라지되 흩어지지 않도록 한 시스템 안에 모읍니다.',
    detail: '세 채널이 무거운 카드 대신 얇은 신호 가지처럼 뻗어 나가며, 고객 입력 흐름이 어떻게 들어오는지 한 번에 보여줍니다.',
    highlights: ['문의 캡처', '예약 캡처', '웨이팅 캡처'],
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    title: '갈라진 신호를 다시 모아 고객 기억 코어와 타임라인으로 응축합니다.',
    detail: '공개 페이지 유입과 문의, 예약, 웨이팅이 하나의 기억 엔진으로 결합되며 MyBiz만의 고객 메모리 흐름이 드러납니다.',
    highlights: ['고객 기억 코어', '방문 타임라인', '재방문 연결'],
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    title: '기억 코어에서 지금 필요한 다음 액션만 추려 실행안으로 꺼냅니다.',
    detail: '리마인드 메시지, 업셀 힌트, 예약 후속 조치처럼 바로 움직일 수 있는 액션만 보여주고 아직 대시보드는 드러내지 않습니다.',
    highlights: ['리마인드 메시지', '업셀 힌트', '예약 후속 조치'],
  },
  {
    id: 'operations-dashboard',
    number: '05',
    label: '운영 대시보드',
    title: '같은 메모리 엔진에서 생성된 스토어와 운영 대시보드가 마지막 보상처럼 떠오릅니다.',
    detail: '먼저 생성된 스토어 셸이 드러나고, 그 위로 운영 대시보드가 안착하며 고객 기억이 매출 회복으로 이어지는 장면을 완성합니다.',
    highlights: ['생성된 스토어', '운영 우선순위', '매출 회복 흐름'],
  },
] as const;

export type DiagnosisCorridorStep = (typeof DIAGNOSIS_CORRIDOR_STEPS)[number];
export type DiagnosisCorridorStepId = DiagnosisCorridorStep['id'];

export const DIAGNOSIS_CORRIDOR_LAST_INDEX = DIAGNOSIS_CORRIDOR_STEPS.length - 1;
export const DIAGNOSIS_CORRIDOR_LINK_STATE = { corridorEntry: true } as const;

export function clampDiagnosisCorridorStepIndex(stepIndex: number) {
  return Math.min(DIAGNOSIS_CORRIDOR_LAST_INDEX, Math.max(0, stepIndex));
}

export function getDiagnosisCorridorStep(stepIndex: number) {
  return DIAGNOSIS_CORRIDOR_STEPS[clampDiagnosisCorridorStepIndex(stepIndex)];
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

export function isDiagnosisShellPath(pathname: string) {
  return pathname === '/' || pathname === SUBSCRIPTION_START_PATH;
}
