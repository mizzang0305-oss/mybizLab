import type { BillingPlanCode } from '@/shared/lib/billingPlans';

const STORAGE_KEY = 'mybizlab:onboarding-flow';
const ALL_FEATURES = [
  'ai_manager',
  'ai_business_report',
  'customer_management',
  'reservation_management',
  'schedule_management',
  'surveys',
  'brand_management',
  'sales_analysis',
  'order_management',
  'waiting_board',
  'contracts',
  'table_order',
] as const;

type FeatureKey = (typeof ALL_FEATURES)[number];

export type OnboardingStep = 'diagnosis' | 'result' | 'request' | 'payment' | 'activation';
export type OnboardingPaymentStatus = 'idle' | 'processing' | 'paid' | 'failed';
export type OnboardingActivationStatus = 'idle' | 'processing' | 'completed';
export type DiagnosisAnalysisSource = 'gpt' | 'fallback';

export interface DiagnosisInput {
  businessType: string;
  region: string;
  customerType: string;
  operatingConcerns: string;
}

export interface DiagnosisResult {
  score: number;
  summary: string;
  coreBottlenecks: string[];
  recommendedStrategies: string[];
  revenueOpportunities: string[];
  immediateActions: string[];
  expansionFeatures: string[];
  reportSummary: string;
  suggestedFeatures: FeatureKey[];
  recommendedPlan: BillingPlanCode;
  analysisSource: DiagnosisAnalysisSource;
  analysisBasis: string;
  limitationsNote: string;
}

export interface DiagnosisModelDraft {
  score?: unknown;
  summary?: unknown;
  coreBottlenecks?: unknown;
  recommendedStrategies?: unknown;
  revenueOpportunities?: unknown;
  immediateActions?: unknown;
  expansionFeatures?: unknown;
  reportSummary?: unknown;
  suggestedFeatures?: unknown;
  recommendedPlan?: unknown;
}

export interface StoreRequestDraft {
  storeName: string;
  ownerName: string;
  phone: string;
  email: string;
  businessType: string;
  region: string;
  requestedSlug: string;
}

export interface OnboardingFlowState {
  step: OnboardingStep;
  diagnosisInput: DiagnosisInput;
  diagnosisResult: DiagnosisResult | null;
  requestDraft: StoreRequestDraft;
  requestId?: string;
  selectedPlan: BillingPlanCode;
  paymentStatus: OnboardingPaymentStatus;
  paymentId?: string;
  paymentFallbackUsed?: boolean;
  activationStatus: OnboardingActivationStatus;
  createdStoreId?: string;
}

export const DIAGNOSIS_LOADING_STAGES = [
  '지역/업종 분석',
  '고객 유형 해석',
  '운영 병목 도출',
  '매출 개선 전략 정리',
] as const;

const FEATURE_COPY: Record<FeatureKey, { expansion: string; label: string }> = {
  ai_manager: {
    expansion: 'AI 점장이 운영 이슈와 다음 액션을 매일 정리합니다.',
    label: 'AI 점장',
  },
  ai_business_report: {
    expansion: '일별, 주간, 월간 운영 리포트를 자동 요약합니다.',
    label: 'AI 운영 리포트',
  },
  brand_management: {
    expansion: '공지, 배너, 기본 브랜딩을 한 화면에서 관리합니다.',
    label: '브랜드 관리',
  },
  contracts: {
    expansion: '거래처와 운영 계약 상태를 함께 추적합니다.',
    label: '계약 관리',
  },
  customer_management: {
    expansion: '재방문 고객 세그먼트와 고객 메모를 운영에 연결합니다.',
    label: '고객 관리',
  },
  order_management: {
    expansion: '주문 누락과 현장 처리 지연을 줄이기 위한 주문 관리를 제공합니다.',
    label: '주문 관리',
  },
  reservation_management: {
    expansion: '예약, 노쇼, 피크 시간 좌석 회전을 함께 추적합니다.',
    label: '예약 관리',
  },
  sales_analysis: {
    expansion: '객단가, 채널별 매출, 피크 시간 성과를 비교합니다.',
    label: '매출 분석',
  },
  schedule_management: {
    expansion: '오픈 전 체크리스트와 근무 일정을 운영 이슈와 연결합니다.',
    label: '일정 관리',
  },
  surveys: {
    expansion: '방문 후 피드백과 만족도 신호를 재방문 액션에 반영합니다.',
    label: '설문 관리',
  },
  table_order: {
    expansion: 'QR 주문과 현장 주문 흐름을 연결해 회전율을 높입니다.',
    label: '테이블오더',
  },
  waiting_board: {
    expansion: '웨이팅 시간을 가시화해 이탈을 줄이고 현장 응대를 표준화합니다.',
    label: '웨이팅보드',
  },
};

const BUSINESS_KEYWORDS = {
  dining: ['브런치', '레스토랑', '고깃집', '식당', '파인다이닝'],
  quickService: ['카페', '디저트', '베이커리', '배달', '분식'],
} as const;

const CONCERN_SIGNALS = {
  customerLoyalty: ['단골', '재방문', 'crm', '고객', '멤버십', '리뷰'],
  orderFlow: ['주문', '배달', '메뉴', '객단가', '세트', '주방'],
  peakFlow: ['예약', '대기', '피크', '점심', '좌석', '회전'],
  reporting: ['매출', '분석', '비용', '마진', '리포트', '데이터'],
} as const;

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeRequestedStoreSlug(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{Script=Hangul}a-z0-9\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'store';
}

function fillStringArray(candidate: unknown, fallback: string[], maxItems = 3) {
  if (!Array.isArray(candidate)) {
    return fallback.slice(0, maxItems);
  }

  const normalized = candidate
    .map((item) => (typeof item === 'string' ? compactText(item) : ''))
    .filter(Boolean)
    .slice(0, maxItems);

  if (normalized.length >= Math.min(maxItems, fallback.length)) {
    return normalized;
  }

  const next = [...normalized];

  for (const value of fallback) {
    if (next.length >= maxItems) {
      break;
    }
    if (!next.includes(value)) {
      next.push(value);
    }
  }

  return next;
}

function fillFeatureKeys(candidate: unknown, fallback: FeatureKey[]) {
  if (!Array.isArray(candidate)) {
    return fallback;
  }

  const normalized = uniqueValues(
    candidate.filter((item): item is FeatureKey => typeof item === 'string' && ALL_FEATURES.includes(item as FeatureKey)),
  ).slice(0, 6);

  return normalized.length >= 3 ? normalized : fallback;
}

function trimSentenceEnding(value: string) {
  return value.trim().replace(/[.!?]+$/u, '');
}

function clampScore(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(58, Math.min(94, Math.round(value)));
}

function deriveRecommendedPlan(features: FeatureKey[]) {
  if (features.length >= 6 || features.includes('ai_business_report')) {
    return 'business';
  }

  if (features.length >= 4 || features.includes('customer_management') || features.includes('reservation_management')) {
    return 'pro';
  }

  return 'starter';
}

function featureExpansionCopy(features: FeatureKey[]) {
  const expansions = features.map((feature) => FEATURE_COPY[feature]?.expansion).filter(Boolean) as string[];

  return fillStringArray(expansions, [
    '고객, 예약, 주문, 매출 흐름을 한 화면에서 보고 우선순위를 정리합니다.',
    'AI 리포트가 반복되는 운영 이슈를 주간 단위로 정리합니다.',
    '스토어 운영 데이터가 쌓일수록 더 정교한 실행 제안을 받을 수 있습니다.',
  ]);
}

function buildAnalysisBasis(input: DiagnosisInput) {
  return `입력된 업종(${input.businessType || '매장'}), 지역(${input.region || '상권'}), 고객 유형(${input.customerType || '방문 고객'}), 운영 고민을 바탕으로 추론했습니다.`;
}

function buildLimitationsNote() {
  return '실시간 POS, 예약, 주문, 매출 원본 데이터와 외부 상권 데이터는 아직 연결되지 않아 입력값 기반 추론으로 작성되었습니다.';
}

function createFallbackDiagnosisSeed(input: DiagnosisInput) {
  const businessType = compactText(input.businessType || '매장');
  const region = compactText(input.region || '지역 상권');
  const customerType = compactText(input.customerType || '방문 고객');
  const concerns = normalizeText(input.operatingConcerns);
  const customerKeywords = normalizeText(customerType);
  const businessKeywords = normalizeText(businessType);
  const suggestedFeatures: FeatureKey[] = ['ai_manager', 'sales_analysis', 'order_management'];
  const coreBottlenecks: string[] = [];
  const recommendedStrategies: string[] = [];
  const revenueOpportunities: string[] = [];
  const immediateActions: string[] = [];
  let score = 63;

  if (includesAny(concerns, CONCERN_SIGNALS.peakFlow) || includesAny(customerKeywords, ['직장인', '점심', '오피스'])) {
    suggestedFeatures.push('reservation_management', 'waiting_board');
    coreBottlenecks.push(`${region} 피크 시간대에 예약과 현장 대기가 한 흐름으로 관리되지 않아 이탈 가능성이 큽니다.`);
    recommendedStrategies.push(`${region} 기준 피크 시간 예약, 대기, 좌석 회전을 한 화면에서 보도록 운영 동선을 통합하세요.`);
    revenueOpportunities.push('피크 시간 예약 확정률과 대기 이탈률만 낮춰도 가장 빠른 매출 회수가 가능합니다.');
    immediateActions.push('점심·저녁 피크 시간을 기준으로 예약 마감선과 현장 대기 응대 문구를 먼저 표준화하세요.');
    score += 8;
  }

  if (includesAny(concerns, CONCERN_SIGNALS.customerLoyalty) || includesAny(customerKeywords, ['재방문', '단골', '멤버십'])) {
    suggestedFeatures.push('customer_management', 'ai_business_report');
    coreBottlenecks.push(`${customerType} 흐름이 고객 기록과 재방문 액션으로 이어지지 않아 반복 매출이 누수되고 있습니다.`);
    recommendedStrategies.push(`${customerType} 중심으로 재방문 주기와 방문 이유를 분류해 캠페인 기준을 만드세요.`);
    revenueOpportunities.push('재방문 고객 세그먼트와 맞춤 제안만 정리해도 단골 매출 비중을 안정적으로 높일 수 있습니다.');
    immediateActions.push('최근 방문 고객을 재방문 가능성 기준으로 나누고, 다음 방문 유도 메시지를 2가지로만 시작하세요.');
    score += 8;
  }

  if (includesAny(concerns, CONCERN_SIGNALS.orderFlow) || includesAny(businessKeywords, BUSINESS_KEYWORDS.quickService)) {
    suggestedFeatures.push('table_order');
    coreBottlenecks.push(`${businessType} 주문 흐름에서 대표 메뉴와 추가 주문 제안이 분리되어 객단가 상승 기회를 놓치고 있습니다.`);
    recommendedStrategies.push(`${businessType} 대표 메뉴와 추가 주문 조합을 운영 화면과 현장 응대 문구에서 함께 추천하세요.`);
    revenueOpportunities.push('세트 제안과 추가 주문 동선을 정리하면 객단가와 회전율을 동시에 개선할 여지가 있습니다.');
    immediateActions.push('상위 3개 메뉴에만 추가 주문 제안을 붙여 현장 주문 멘트와 주문 화면을 통일하세요.');
    score += 6;
  }

  if (includesAny(concerns, CONCERN_SIGNALS.reporting)) {
    suggestedFeatures.push('ai_business_report');
    coreBottlenecks.push('일·주·월 운영 지표가 한 문맥으로 정리되지 않아 개선 우선순위 판단이 늦어지고 있습니다.');
    recommendedStrategies.push('일별 이슈와 주간 실행 과제를 연결하는 AI 운영 리포트를 기준 보고서로 삼으세요.');
    revenueOpportunities.push('운영 지표를 정기적으로 비교하면 할인, 배달, 예약 운영의 손익 판단 속도가 빨라집니다.');
    immediateActions.push('일별 매출, 예약 전환, 재방문 고객 비중 3개만 이번 주 핵심 지표로 고정하세요.');
    score += 5;
  }

  if (includesAny(businessKeywords, BUSINESS_KEYWORDS.dining)) {
    suggestedFeatures.push('reservation_management');
    score += 3;
  }

  if (input.operatingConcerns.trim().length >= 24) {
    score += 3;
  }

  const normalizedFeatures = uniqueValues(suggestedFeatures);
  const fallbackBottlenecks = [
    `${region} 상권 기준으로 고객 흐름과 운영 대응이 분리되어 있어 현장 판단 속도가 떨어질 가능성이 있습니다.`,
    `${businessType} 운영 데이터가 실행 우선순위로 바로 연결되지 않아 개선 액션이 뒤로 밀릴 수 있습니다.`,
    `${customerType} 흐름을 세분화하지 않으면 재방문과 객단가 개선 기회를 동시에 놓치기 쉽습니다.`,
  ];
  const fallbackStrategies = [
    `${businessType} 고객 흐름을 예약, 주문, 매출 지표와 함께 보도록 운영 기준판을 먼저 만드세요.`,
    `${region} 상권 특성에 맞춰 피크 시간 대응과 재방문 액션을 주간 단위로 점검하세요.`,
    'AI 진단 결과를 기준으로 이번 주 실행할 운영 개선 항목 3가지만 먼저 고정해 반복하세요.',
  ];
  const fallbackRevenue = [
    '고객 재방문 관리와 피크 시간 전환율 개선이 가장 빠른 성장 포인트입니다.',
    '주문 흐름과 매출 데이터를 함께 보면 운영 병목을 더 빠르게 찾을 수 있습니다.',
    '주간 운영 리포트를 기준으로 실행 항목을 반복하면 매출 개선 속도가 높아집니다.',
  ];
  const fallbackActions = [
    '이번 주 운영 점검 시간을 정해 예약, 주문, 고객 이슈를 한 번에 보는 루틴을 만드세요.',
    '직원 응대 문구와 운영 체크리스트를 3개 항목으로 줄여 실행 부담을 낮추세요.',
    '다음 주까지 확인할 핵심 지표를 3개만 선택해 매일 같은 시간에 확인하세요.',
  ];

  const filledCoreBottlenecks = fillStringArray(coreBottlenecks, fallbackBottlenecks);
  const filledStrategies = fillStringArray(recommendedStrategies, fallbackStrategies);
  const filledRevenue = fillStringArray(revenueOpportunities, fallbackRevenue);
  const filledActions = fillStringArray(immediateActions, fallbackActions);
  const recommendedPlan = deriveRecommendedPlan(normalizedFeatures);
  const scoreBounded = clampScore(score, 63);
  const primaryBottleneck = trimSentenceEnding(filledCoreBottlenecks[0]);
  const primaryStrategy = trimSentenceEnding(filledStrategies[0]);
  const primaryAction = trimSentenceEnding(filledActions[0]);
  const secondaryAction = trimSentenceEnding(filledActions[1]);

  return {
    analysisBasis: buildAnalysisBasis(input),
    coreBottlenecks: filledCoreBottlenecks,
    expansionFeatures: featureExpansionCopy(normalizedFeatures),
    immediateActions: filledActions,
    limitationsNote: buildLimitationsNote(),
    recommendedPlan,
    recommendedStrategies: filledStrategies,
    reportSummary: `${region} ${businessType} 운영에서는 ${primaryBottleneck} 문제가 가장 큽니다. 이번 리포트는 ${primaryAction} 실행과 ${secondaryAction} 정착을 우선 과제로 권장합니다.`,
    revenueOpportunities: filledRevenue,
    score: scoreBounded,
    suggestedFeatures: normalizedFeatures,
    summary: `${region} ${businessType} 기준으로 보면 ${customerType} 흐름에서 ${primaryBottleneck} 문제가 우선 이슈입니다. AI 진단상 가장 먼저 손봐야 할 과제는 ${primaryStrategy} 입니다.`,
  };
}

export function buildDiagnosisPrompt(input: DiagnosisInput) {
  return [
    'You are preparing a structured Korean diagnosis for a small business SaaS onboarding flow.',
    'Use only the provided inputs. Do not claim access to live POS, reservation, payment, or external market data.',
    'Infer likely operational bottlenecks and practical actions from the inputs.',
    'Keep the result specific, practical, and trustworthy for a Korean small business owner.',
    `업종: ${input.businessType || '미입력'}`,
    `지역: ${input.region || '미입력'}`,
    `고객 유형: ${input.customerType || '미입력'}`,
    `운영 고민: ${input.operatingConcerns || '미입력'}`,
  ].join('\n');
}

export function normalizeDiagnosisResult(
  candidate: DiagnosisModelDraft,
  input: DiagnosisInput,
  analysisSource: DiagnosisAnalysisSource,
): DiagnosisResult {
  const fallback = createFallbackDiagnosisSeed(input);
  const suggestedFeatures = fillFeatureKeys(candidate.suggestedFeatures, fallback.suggestedFeatures);
  const recommendedPlan =
    candidate.recommendedPlan === 'starter' || candidate.recommendedPlan === 'pro' || candidate.recommendedPlan === 'business'
      ? candidate.recommendedPlan
      : deriveRecommendedPlan(suggestedFeatures);

  return {
    analysisBasis: fallback.analysisBasis,
    analysisSource,
    coreBottlenecks: fillStringArray(candidate.coreBottlenecks, fallback.coreBottlenecks),
    expansionFeatures: fillStringArray(candidate.expansionFeatures, featureExpansionCopy(suggestedFeatures)),
    immediateActions: fillStringArray(candidate.immediateActions, fallback.immediateActions),
    limitationsNote: fallback.limitationsNote,
    recommendedPlan,
    recommendedStrategies: fillStringArray(candidate.recommendedStrategies, fallback.recommendedStrategies),
    reportSummary:
      typeof candidate.reportSummary === 'string' && compactText(candidate.reportSummary)
        ? compactText(candidate.reportSummary)
        : fallback.reportSummary,
    revenueOpportunities: fillStringArray(candidate.revenueOpportunities, fallback.revenueOpportunities),
    score: clampScore(candidate.score, fallback.score),
    suggestedFeatures,
    summary:
      typeof candidate.summary === 'string' && compactText(candidate.summary)
        ? compactText(candidate.summary)
        : fallback.summary,
  };
}

export function createInitialOnboardingFlowState(): OnboardingFlowState {
  return {
    step: 'diagnosis',
    diagnosisInput: {
      businessType: '카페',
      region: '서울 성수동',
      customerType: '재방문 고객과 직장인 점심 고객',
      operatingConcerns: '',
    },
    diagnosisResult: null,
    requestDraft: {
      storeName: '',
      ownerName: '',
      phone: '',
      email: '',
      businessType: '카페',
      region: '서울 성수동',
      requestedSlug: '',
    },
    selectedPlan: 'starter',
    paymentStatus: 'idle',
    activationStatus: 'idle',
  };
}

export function buildDiagnosisResult(
  input: DiagnosisInput,
  analysisSource: DiagnosisAnalysisSource = 'fallback',
): DiagnosisResult {
  return normalizeDiagnosisResult(createFallbackDiagnosisSeed(input), input, analysisSource);
}

export function buildRequestDraftFromDiagnosis(input: DiagnosisInput): StoreRequestDraft {
  return {
    storeName: '',
    ownerName: '',
    phone: '',
    email: '',
    businessType: input.businessType,
    region: input.region,
    requestedSlug: '',
  };
}

export function createRequestedSlug(storeName: string) {
  return normalizeRequestedStoreSlug(storeName);
}

export function readOnboardingFlowState() {
  if (typeof window === 'undefined') {
    return createInitialOnboardingFlowState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialOnboardingFlowState();
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingFlowState>;
    return {
      ...createInitialOnboardingFlowState(),
      ...parsed,
      diagnosisInput: {
        ...createInitialOnboardingFlowState().diagnosisInput,
        ...parsed.diagnosisInput,
      },
      requestDraft: {
        ...createInitialOnboardingFlowState().requestDraft,
        ...parsed.requestDraft,
      },
    } satisfies OnboardingFlowState;
  } catch {
    return createInitialOnboardingFlowState();
  }
}

export function persistOnboardingFlowState(state: OnboardingFlowState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearOnboardingFlowState() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
