export const CINEMATIC_CHANNEL_LABELS = ['문의', '예약', '웨이팅', '주문', '상담', '결제'] as const;

export type CinematicChannelLabel = (typeof CINEMATIC_CHANNEL_LABELS)[number];
export type CinematicSceneId =
  | 'action-extraction'
  | 'customer-signals'
  | 'memory-core'
  | 'operations-dashboard'
  | 'store-scan';

export interface CinematicScene {
  accent: string;
  actionCaption: string;
  activeChannels: CinematicChannelLabel[];
  canonicalEntities: string[];
  description: string;
  id: CinematicSceneId;
  label: string;
  memoryCaption: string;
  number: string;
  title: string;
}

export const CINEMATIC_SCENES: CinematicScene[] = [
  {
    accent: '#7dd3fc',
    actionCaption: '가게의 첫 유입 구조를 열고 입력 채널 우선순위를 봅니다.',
    activeChannels: ['문의', '예약'],
    canonicalEntities: ['store_public_pages', 'visitor_sessions'],
    description: '공개 스토어, 메뉴, CTA, 방문 의도를 AI가 먼저 읽고 현재 운영 지도를 만듭니다.',
    id: 'store-scan',
    label: '가게 현황 파악',
    memoryCaption: '아직 흩어진 방문 신호를 고객 기억으로 받을 준비를 합니다.',
    number: '01',
    title: '우리 가게의 현재 신호를 읽습니다',
  },
  {
    accent: '#38bdf8',
    actionCaption: '입력 채널별 다음 행동을 구분합니다.',
    activeChannels: ['문의', '예약', '웨이팅', '주문', '상담', '결제'],
    canonicalEntities: ['inquiries', 'reservations', 'waiting_entries', 'orders', 'conversation_sessions'],
    description: '문의·예약·웨이팅·주문·상담·결제가 고객 신호로 흘러 들어오는 장면입니다.',
    id: 'customer-signals',
    label: '고객 신호 수집',
    memoryCaption: '각 신호가 어느 고객의 행동인지 분리하지 않고 같은 흐름으로 받습니다.',
    number: '02',
    title: '고객 행동이 실시간 신호로 들어옵니다',
  },
  {
    accent: '#c4b5fd',
    actionCaption: '반복 방문, 선호, 문의 맥락을 한 고객 기준으로 묶습니다.',
    activeChannels: ['문의', '예약', '웨이팅', '주문', '상담'],
    canonicalEntities: ['customers', 'customer_timeline_events'],
    description: '흩어진 입력을 고객별 기억 코어로 결합해 단발성 응대를 운영 자산으로 바꿉니다.',
    id: 'memory-core',
    label: '고객 기억 결합',
    memoryCaption: '고객 이름, 방문, 주문, 상담 맥락이 하나의 타임라인으로 쌓입니다.',
    number: '03',
    title: '흩어진 행동이 고객 기억으로 결합됩니다',
  },
  {
    accent: '#fb923c',
    actionCaption: '오늘 해야 할 후속 응대, 예약 확인, 주문 상태, 리포트 힌트를 뽑습니다.',
    activeChannels: ['문의', '예약', '웨이팅', '주문'],
    canonicalEntities: ['customer_timeline_events', 'ai_reports'],
    description: '기억 코어 위에서 점주가 바로 실행할 수 있는 액션을 짧고 선명하게 추출합니다.',
    id: 'action-extraction',
    label: '실행안 도출',
    memoryCaption: '기억은 단순 기록이 아니라 다음 매출 행동을 고르는 근거가 됩니다.',
    number: '04',
    title: '기억 위에서 실행안이 추출됩니다',
  },
  {
    accent: '#f97316',
    actionCaption: '대시보드, 공개 스토어, 운영 상태가 하나의 루프로 정착합니다.',
    activeChannels: ['문의', '예약', '웨이팅', '주문', '상담', '결제'],
    canonicalEntities: ['store_members', 'store_subscriptions', 'store_public_pages', 'customers'],
    description: '공개 유입과 운영 화면이 연결되어 점주가 다음 행동을 바로 확인하는 장면입니다.',
    id: 'operations-dashboard',
    label: '운영 대시보드 생성',
    memoryCaption: '쌓인 고객 기억이 대시보드의 우선순위와 운영 리포트로 보입니다.',
    number: '05',
    title: '운영 루프가 대시보드로 정착됩니다',
  },
];

export function clampCinematicSceneIndex(stepIndex: number) {
  return Math.min(CINEMATIC_SCENES.length - 1, Math.max(0, Math.trunc(stepIndex)));
}

export function getCinematicScene(stepIndex: number) {
  return CINEMATIC_SCENES[clampCinematicSceneIndex(stepIndex)];
}

export function getCinematicSceneForDiagnosisStep(step: string, hasEnoughInput: boolean) {
  if (step === 'diagnosis') return getCinematicScene(hasEnoughInput ? 1 : 0);
  if (step === 'result') return getCinematicScene(2);
  if (step === 'request') return getCinematicScene(3);
  return getCinematicScene(4);
}
