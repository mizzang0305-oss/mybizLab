export const CINEMATIC_CHANNEL_LABELS = ['문의', '예약', '웨이팅', '주문', '상담', '결제'] as const;

export type CinematicChannelLabel = (typeof CINEMATIC_CHANNEL_LABELS)[number];
export type HomepageServiceNodeLabel =
  | 'QR 주문'
  | '결제'
  | '고객 기억'
  | '공개 스토어'
  | '문의'
  | '예약'
  | '웨이팅'
  | '점주 운영 화면';
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

export interface HomepageServiceNode {
  description: string;
  label: HomepageServiceNodeLabel;
  tone: 'blue' | 'orange' | 'purple';
  x: number;
  y: number;
}

export interface ProductStoryPanel {
  body: string;
  highlights: string[];
  metric: string;
  title: string;
  type: 'customer-memory' | 'dashboard' | 'storefront';
}

export interface ConsultationStoryStep {
  caption: string;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
}

export interface ConnectedServiceCard {
  action: string;
  detail: string;
  metric: string;
  title: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
}

export const HOMEPAGE_SERVICE_NODES: HomepageServiceNode[] = [
  { description: '방문 전 궁금한 내용을 고객 기억으로 남깁니다.', label: '문의', tone: 'blue', x: 66, y: 16 },
  { description: '예약 의도와 방문 시간을 운영 화면으로 연결합니다.', label: '예약', tone: 'blue', x: 32, y: 22 },
  { description: '대기 현황과 방문 밀도를 실시간 신호로 봅니다.', label: '웨이팅', tone: 'purple', x: 22, y: 48 },
  { description: '테이블 주문이 고객 행동 증거로 쌓입니다.', label: 'QR 주문', tone: 'orange', x: 30, y: 72 },
  { description: '결제 상태를 주문 흐름과 구분해 안전하게 봅니다.', label: '결제', tone: 'blue', x: 50, y: 84 },
  { description: '공개 페이지가 첫 고객 유입 엔진이 됩니다.', label: '공개 스토어', tone: 'orange', x: 82, y: 32 },
  { description: '흩어진 행동을 한 고객 타임라인으로 묶습니다.', label: '고객 기억', tone: 'purple', x: 82, y: 58 },
  { description: '점주가 오늘 할 일을 바로 확인합니다.', label: '점주 운영 화면', tone: 'blue', x: 72, y: 78 },
];

export const PRODUCT_STORY_PANELS: ProductStoryPanel[] = [
  {
    body: '고객이 매장을 발견하고 문의·예약·웨이팅·QR 주문으로 바로 들어오는 첫 접점입니다.',
    highlights: ['문의하기', '예약하기', '웨이팅', 'QR 주문'],
    metric: '첫 방문 신호 수집',
    title: '공개 스토어 / 고객 접점',
    type: 'storefront',
  },
  {
    body: '점주는 예약, 웨이팅, 주문, 매출, 실시간 알림을 한 화면에서 보고 바로 실행합니다.',
    highlights: ['예약', '웨이팅', '주문', '매출', '실시간 알림'],
    metric: '오늘 운영 현황',
    title: '점주 운영 대시보드',
    type: 'dashboard',
  },
  {
    body: '고객명, 방문 횟수, 최근 방문일, 선호 메뉴와 시간, 추천 액션이 반복 매출의 근거가 됩니다.',
    highlights: ['고객명', '방문 횟수', '최근 방문일', '선호 메뉴/선호 시간', '추천 액션'],
    metric: '재방문 액션 추천',
    title: '고객 기억 / 반복 매출 엔진',
    type: 'customer-memory',
  },
];

export const CONSULTATION_PROGRESS_LABELS = ['정보 수집', '현황 분석', '이슈 진단', '솔루션 제안', '실행 계획'] as const;

export const CONSULTATION_STORY_STEPS: ConsultationStoryStep[] = [
  { caption: '더 많은 고객이 우리 가게를 발견해요', label: '고객 유입', tone: 'blue' },
  { caption: '소중한 대화가 데이터로 남아요', label: '상담 기록', tone: 'blue' },
  { caption: '좋은 경험은 기억이 되어 다시 찾게 만들어요', label: '고객 기억', tone: 'orange' },
  { caption: '기다림과 방문으로 방문 밀도가 높아져요', label: '예약·웨이팅', tone: 'purple' },
  { caption: '주문부터 처리까지 매끄럽게 연결돼요', label: '주문 흐름', tone: 'orange' },
  { caption: '데이터 기반 의사결정으로 운영이 효율적으로 진화해요', label: '운영 개선', tone: 'green' },
  { caption: '더 많은 단골이 생기고 우리 가게를 추천해요', label: '재방문 유도', tone: 'purple' },
  { caption: '지속 가능한 성장을 위한 인사이트가 쌓여요', label: '매출 인사이트', tone: 'orange' },
];

export const CONNECTED_SERVICE_CARDS: ConnectedServiceCard[] = [
  { action: '스토어 보기', detail: '스토어 미리보기', metric: '공개 중', title: '공개 스토어', tone: 'blue' },
  { action: '예약 관리', detail: '2024.05 주요 예약', metric: '22건', title: '예약', tone: 'purple' },
  { action: '웨이팅 관리', detail: '예상 대기 시간 25분', metric: '12팀', title: '웨이팅', tone: 'orange' },
  { action: '문의 관리', detail: '최근 문의 미리보기', metric: '신규 4건', title: '문의', tone: 'blue' },
  { action: '주문 관리', detail: '조리 중 5건', metric: '접수 8건', title: '주문', tone: 'orange' },
  { action: '상담 열기', detail: 'AI가 실시간으로 인사이트를 제안합니다.', metric: '분석 중', title: 'AI 상담', tone: 'purple' },
  { action: '대시보드 보기', detail: '전일 대비 +12.6%', metric: '3,458,000원', title: '운영 대시보드', tone: 'green' },
  { action: '고객 관리', detail: '재방문율 28.7%', metric: '1,245명', title: '고객 기억', tone: 'orange' },
  { action: '분석 보기', detail: '월 성장률 +18.3%', metric: '12,564,000원', title: '매출 분석', tone: 'blue' },
];

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
