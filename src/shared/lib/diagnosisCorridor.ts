import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export const DIAGNOSIS_CORRIDOR_STEPS = [
  {
    id: 'store-check',
    number: '01',
    label: '스토어 확인',
    title: '공개 페이지에 들어온 첫 신호가 어떤 매장인지 먼저 확인합니다.',
    detail: '유입이 시작되는 순간부터 공개 페이지와 스토어 문맥을 어두운 필드 위에 붙여서 진단을 시작합니다.',
    highlights: ['공개 페이지 진입', '스토어 문맥 확인', '첫 방문 신호 기록'],
  },
  {
    id: 'signal-capture',
    number: '02',
    label: '신호 수집',
    title: '문의, 예약, 웨이팅 신호를 한 흐름으로 받아서 놓치지 않습니다.',
    detail: '세 채널이 따로 흩어지지 않고 같은 레일 위에서 살아 있는 가지처럼 움직이며 고객 신호를 모읍니다.',
    highlights: ['문의 캡처', '예약 캡처', '웨이팅 캡처'],
  },
  {
    id: 'memory-merge',
    number: '03',
    label: '고객 기억 결합',
    title: '분리된 신호를 한 고객의 기억과 타임라인으로 결합합니다.',
    detail: '공개 페이지 유입, 문의, 예약, 웨이팅이 고객 기억 코어로 휘어 들어오며 재방문 매출의 중심점이 만들어집니다.',
    highlights: ['고객 기억 코어', '방문 타임라인', '재방문 식별'],
  },
  {
    id: 'action-plan',
    number: '04',
    label: '실행안 도출',
    title: '기억 코어에서 지금 필요한 다음 행동만 뽑아냅니다.',
    detail: '리마인드 메시지, 업셀 힌트, 예약 후속 조치처럼 바로 실행할 수 있는 액션 경로를 메모리 기반으로 정리합니다.',
    highlights: ['리마인드 메시지', '업셀 힌트', '예약 후속 조치'],
  },
  {
    id: 'operations-dashboard',
    number: '05',
    label: '운영 대시보드',
    title: '같은 시스템이 운영 대시보드로 떠오르며 회복 매출을 보여줍니다.',
    detail: '대시보드는 마지막 단계에서만 등장하고, 고객 기억과 실행안이 실제 운영 화면과 회복 매출로 수렴합니다.',
    highlights: ['운영 우선순위', '회복 매출 추적', '다음 액션 루프'],
  },
] as const;

export type DiagnosisCorridorStep = (typeof DIAGNOSIS_CORRIDOR_STEPS)[number];
export type DiagnosisCorridorStepId = DiagnosisCorridorStep['id'];

export const DIAGNOSIS_CORRIDOR_THRESHOLDS = [0.16, 0.34, 0.56, 0.8] as const;
export const DIAGNOSIS_CORRIDOR_LINK_STATE = { corridorEntry: true } as const;

export function getDiagnosisCorridorStepIndex(progress: number) {
  if (progress >= DIAGNOSIS_CORRIDOR_THRESHOLDS[3]) {
    return 4;
  }

  if (progress >= DIAGNOSIS_CORRIDOR_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= DIAGNOSIS_CORRIDOR_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= DIAGNOSIS_CORRIDOR_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function isDiagnosisShellPath(pathname: string) {
  return pathname === '/' || pathname === SUBSCRIPTION_START_PATH;
}
