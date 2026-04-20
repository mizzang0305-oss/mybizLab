import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import {
  getAvailableDataLabels,
  getConcernLabel,
  getDesiredOutcomeLabel,
  getIndustryLabel,
  getRecommendedDataModeLabel,
  getRecommendedStoreModeLabel,
  recommendDataMode,
  recommendModules,
  recommendQuestions,
  recommendStoreMode,
  summarizeDiagnosisInput,
  type DiagnosisAvailableDataKey,
  type DiagnosisDataMode,
  type DiagnosisRecommendedStoreMode,
  type DiagnosisSelectedStoreMode,
} from '@/shared/lib/diagnosisBlueprint';
import { diagnosisInputSchema, diagnosisModelDraftSchema, type DiagnosisInputDocument } from '@/shared/lib/diagnosisSchema';
import { getFeatureLabel } from '@/shared/lib/platformConsole';
import type { StoreSetupPreviewTarget, StoreSetupTheme, StoreSetupWizardStep } from '@/shared/lib/storeSetupSchema';
import type { FeatureKey } from '@/shared/types/models';

const STORAGE_KEY = 'mybizlab:onboarding-flow';

export type OnboardingStep = 'diagnosis' | 'result' | 'request' | 'payment' | 'activation';
export type OnboardingPaymentStatus = 'idle' | 'processing' | 'paid' | 'failed';
export type OnboardingActivationStatus = 'idle' | 'processing' | 'completed';
export type DiagnosisAnalysisSource = 'gpt' | 'fallback';

export interface DiagnosisInput {
  availableData: DiagnosisAvailableDataKey[];
  currentConcern: DiagnosisInputDocument['currentConcern'];
  desiredOutcome: DiagnosisInputDocument['desiredOutcome'];
  industryType: DiagnosisInputDocument['industryType'];
  region: string;
  storeModeSelection: DiagnosisSelectedStoreMode;
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
  recommendedModules: FeatureKey[];
  recommendedQuestions: string[];
  recommendedStoreMode: DiagnosisRecommendedStoreMode;
  recommendedDataMode: DiagnosisDataMode;
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
  recommendedModules?: unknown;
  recommendedQuestions?: unknown;
  recommendedStoreMode?: unknown;
  recommendedDataMode?: unknown;
  recommendedPlan?: unknown;
}

export interface StoreRequestDraft {
  address: string;
  brandName: string;
  dataMode: DiagnosisDataMode;
  description: string;
  storeName: string;
  ownerName: string;
  phone: string;
  email: string;
  businessType: string;
  mobileCtaLabel: string;
  openingHours: string;
  previewTarget: StoreSetupPreviewTarget;
  primaryCtaLabel: string;
  publicStatus: 'public' | 'private';
  region: string;
  requestedSlug: string;
  selectedFeatures: FeatureKey[];
  storeMode: DiagnosisRecommendedStoreMode;
  tagline: string;
  themePreset: StoreSetupTheme;
}

export interface OnboardingFlowState {
  step: OnboardingStep;
  diagnosisInput: DiagnosisInput;
  diagnosisResult: DiagnosisResult | null;
  requestDraft: StoreRequestDraft;
  requestWizardStep: StoreSetupWizardStep;
  requestId?: string;
  selectedPlan: BillingPlanCode;
  paymentStatus: OnboardingPaymentStatus;
  paymentId?: string;
  paymentFallbackUsed?: boolean;
  activationStatus: OnboardingActivationStatus;
  createdStoreId?: string;
}

const DEFAULT_DIAGNOSIS_INPUT: DiagnosisInput = {
  availableData: ['no_feedback', 'manual_notes'],
  currentConcern: 'unknown_customer_reaction',
  desiredOutcome: 'customer_sentiment',
  industryType: 'cafe',
  region: '서울 성수동',
  storeModeSelection: 'not_sure',
};

export const DIAGNOSIS_LOADING_STAGES = [
  '업종과 운영 방식 해석',
  '현재 고민과 목표 연결',
  '데이터 모드 추천',
  '모듈과 질문 세트 정리',
] as const;

const FEATURE_EXPANSIONS: Record<FeatureKey, string> = {
  ai_manager: 'AI 점장이 오늘 봐야 할 운영 요약과 실행 순서를 먼저 정리합니다.',
  ai_business_report: '주간 운영 리포트로 반복되는 이슈와 개선 추세를 한 번에 볼 수 있습니다.',
  brand_management: '브랜드 첫 화면과 공지 메시지를 점주가 직접 다듬을 수 있습니다.',
  contracts: '향후 거래처/외부 제휴 관리까지 이어질 수 있는 기반 모듈입니다.',
  customer_management: '재방문 고객과 문의 고객을 분리해 대응 흐름을 잡을 수 있습니다.',
  order_management: '주문 흐름과 피크 시간 병목을 한눈에 보고 운영 기준을 맞출 수 있습니다.',
  reservation_management: '예약과 문의 응대를 놓치지 않도록 접수 흐름을 묶어줍니다.',
  sales_analysis: '매출과 반응 데이터를 함께 비교해 점주가 해석하기 쉬운 지표를 보여줍니다.',
  schedule_management: '오픈 준비, 피크 대응, 담당자 체크리스트를 함께 묶을 수 있습니다.',
  surveys: '설문 응답을 꾸준히 모아 만족/불만 흐름을 눈으로 확인할 수 있습니다.',
  table_order: 'QR 주문이나 추가 주문 흐름을 자연스럽게 붙일 수 있습니다.',
  waiting_board: '대기 시간과 현장 응대를 분리하지 않고 하나의 흐름으로 관리할 수 있습니다.',
};

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
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
    candidate.filter((item): item is FeatureKey => typeof item === 'string' && Object.hasOwn(FEATURE_EXPANSIONS, item)),
  ).slice(0, 6);

  return normalized.length >= 3 ? normalized : fallback;
}

function clampScore(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(58, Math.min(94, Math.round(value)));
}

function deriveRecommendedPlan(features: FeatureKey[]) {
  if (features.length >= 6 || features.includes('ai_business_report')) {
    return 'vip';
  }

  if (features.length >= 4 || features.includes('customer_management') || features.includes('reservation_management')) {
    return 'pro';
  }

  return 'free';
}

function derivePublicTheme(industryType: DiagnosisInput['industryType']): StoreSetupTheme {
  if (industryType === 'korean_buffet' || industryType === 'restaurant') {
    return 'warm';
  }

  if (industryType === 'cafe' || industryType === 'service') {
    return 'modern';
  }

  return 'light';
}

function derivePreviewTarget(storeMode: DiagnosisRecommendedStoreMode): StoreSetupPreviewTarget {
  if (storeMode === 'brand_inquiry_first') {
    return 'inquiry';
  }

  if (storeMode === 'order_first' || storeMode === 'hybrid') {
    return 'order';
  }

  return 'survey';
}

function derivePrimaryCtaLabel(previewTarget: StoreSetupPreviewTarget) {
  if (previewTarget === 'inquiry') {
    return '문의 남기기';
  }

  if (previewTarget === 'order') {
    return '오늘 메뉴 보기';
  }

  return '설문 참여하기';
}

function deriveMobileCtaLabel(previewTarget: StoreSetupPreviewTarget) {
  if (previewTarget === 'inquiry') {
    return '문의하기';
  }

  if (previewTarget === 'order') {
    return '메뉴 보기';
  }

  return '바로 참여';
}

function featureExpansionCopy(features: FeatureKey[]) {
  const expansions = features.map((feature) => FEATURE_EXPANSIONS[feature]).filter(Boolean);

  return fillStringArray(expansions, [
    '점주가 오늘 봐야 할 화면을 줄여서 운영 판단 시간을 단축할 수 있습니다.',
    '실제 데이터가 쌓일수록 설문, 문의, 주문 흐름을 같은 문맥에서 이해할 수 있습니다.',
    '복잡한 BI보다 바로 행동할 수 있는 운영 OS에 가깝게 구성할 수 있습니다.',
  ]);
}

function buildAnalysisBasis(input: DiagnosisInput) {
  const availableDataLabels = getAvailableDataLabels(input.availableData);
  const selectedModeLabel =
    input.storeModeSelection === 'not_sure' ? '아직 모르겠음' : getRecommendedStoreModeLabel(input.storeModeSelection);

  return [
    `입력된 업종은 ${getIndustryLabel(input.industryType)}입니다.`,
    `현재 선택한 운영 방식은 ${selectedModeLabel}이며, 가장 큰 고민은 ${getConcernLabel(input.currentConcern)}입니다.`,
    `보유 데이터는 ${availableDataLabels.join(', ')}이며, 목표는 ${getDesiredOutcomeLabel(input.desiredOutcome)}입니다.`,
  ].join(' ');
}

function buildLimitationsNote() {
  return '실시간 POS, 주문, 예약, 외부 상권 데이터는 아직 연결되지 않아 입력값과 추천 규칙 기반으로 구조화된 결과를 생성했습니다.';
}

function buildCoreBottlenecks(input: DiagnosisInput, storeModeLabel: string, dataModeLabel: string, availableDataLabels: string[]) {
  const concernCopy: Record<DiagnosisInput['currentConcern'], string> = {
    brand_identity: '첫 화면에서 매장 차별점이 약해 문의 전환으로 이어지기 어렵습니다.',
    busy_peak_ops: '피크 시간 운영과 현장 응대가 분리되어 점주 판단이 늦어질 가능성이 큽니다.',
    menu_response: '메뉴 반응과 추가 주문 흐름이 끊겨 객단가 개선 포인트가 가려져 있습니다.',
    service_quality: '응대 품질에 대한 고객 신호가 부족해 무엇을 먼저 고쳐야 하는지 알기 어렵습니다.',
    slow_inquiries: '문의와 예약 응답이 분산되어 고객 전환 기회를 놓치기 쉽습니다.',
    unknown_customer_reaction: '고객 만족과 불만이 눈에 보이지 않아 감으로 운영하게 됩니다.',
  };

  return [
    concernCopy[input.currentConcern],
    `현재 보유한 데이터(${availableDataLabels.join(', ')})만으로는 ${getDesiredOutcomeLabel(input.desiredOutcome)}를 바로 판단하기 어렵습니다.`,
    `${storeModeLabel} + ${dataModeLabel} 구조가 아직 정리되지 않으면 점주가 첫 화면에서 무엇을 봐야 할지 헷갈릴 수 있습니다.`,
  ];
}

function buildRecommendedStrategies(
  input: DiagnosisInput,
  storeModeLabel: string,
  dataModeLabel: string,
  recommendedModules: FeatureKey[],
) {
  return [
    `${storeModeLabel} 기준으로 첫 화면과 대시보드 우선순위를 정리해 점주가 매일 같은 루틴으로 보게 하세요.`,
    `${dataModeLabel} 흐름에 맞춰 ${getDesiredOutcomeLabel(input.desiredOutcome)}에 필요한 데이터를 먼저 쌓으세요.`,
    `${getFeatureLabel(recommendedModules[0])}${recommendedModules[1] ? `, ${getFeatureLabel(recommendedModules[1])}` : ''}부터 열어 운영 복잡도를 줄이세요.`,
  ];
}

function buildRevenueOpportunities(input: DiagnosisInput, recommendedModules: FeatureKey[]) {
  const outcomeCopy: Record<DiagnosisInput['desiredOutcome'], string> = {
    brand_growth: '브랜드 설득력이 올라가면 문의와 첫 방문 전환이 함께 개선될 수 있습니다.',
    customer_sentiment: '만족과 불만 포인트를 먼저 잡으면 재방문과 후기 품질을 동시에 끌어올릴 수 있습니다.',
    menu_analysis: '메뉴 반응을 정리하면 대표 메뉴와 추가 주문 조합을 더 빠르게 실험할 수 있습니다.',
    operations_analysis: '피크 시간 병목을 줄이면 동일 인력으로도 더 많은 주문과 응대를 처리할 수 있습니다.',
    service_improvement: '응대 품질이 안정되면 단골 전환과 고객 문의 감소가 함께 일어날 가능성이 큽니다.',
  };

  return [
    outcomeCopy[input.desiredOutcome],
    `${getFeatureLabel(recommendedModules[0])} 중심으로 화면을 단순화하면 점주가 매일 실행을 이어가기 쉽습니다.`,
    `${recommendedModules.includes('ai_business_report') ? '주간 리포트까지 연결하면' : '핵심 모듈만 먼저 적용해도'} 점주 설명력이 높아져 영업 데모에도 유리합니다.`,
  ];
}

function buildImmediateActions(
  storeModeLabel: string,
  dataModeLabel: string,
  recommendedModules: FeatureKey[],
  recommendedQuestions: string[],
) {
  return [
    `${storeModeLabel} 흐름 기준으로 오늘 가장 먼저 보여줄 카드 3개만 결정하세요.`,
    `${dataModeLabel}에 맞춰 "${recommendedQuestions[0]}" 질문부터 수집을 시작하세요.`,
    `${getFeatureLabel(recommendedModules[0])}${recommendedModules[1] ? `과 ${getFeatureLabel(recommendedModules[1])}` : ''}만 먼저 켜서 운영 화면을 단순하게 유지하세요.`,
  ];
}

function calculateScore(input: DiagnosisInput, recommendedModules: FeatureKey[], recommendedStoreMode: DiagnosisRecommendedStoreMode, recommendedDataMode: DiagnosisDataMode) {
  let score = 66 + input.availableData.length * 3 + Math.min(recommendedModules.length, 6);

  if (input.storeModeSelection !== 'not_sure' && input.storeModeSelection === recommendedStoreMode) {
    score += 4;
  }

  if (recommendedDataMode === 'order_survey_manual') {
    score += 5;
  }

  if (recommendedDataMode === 'survey_manual' || recommendedDataMode === 'order_survey') {
    score += 3;
  }

  if (input.currentConcern === 'busy_peak_ops' || input.currentConcern === 'service_quality') {
    score += 4;
  }

  if (input.desiredOutcome === 'brand_growth' || input.desiredOutcome === 'operations_analysis') {
    score += 2;
  }

  return clampScore(score, 72);
}

function createFallbackDiagnosisSeed(input: DiagnosisInput) {
  const normalizedInput = diagnosisInputSchema.parse(input);
  const recommendedStoreMode = recommendStoreMode(normalizedInput);
  const recommendedDataMode = recommendDataMode(normalizedInput);
  const recommendedModules = recommendModules(normalizedInput, recommendedStoreMode, recommendedDataMode);
  const recommendedQuestions = recommendQuestions(normalizedInput);
  const recommendedPlan = deriveRecommendedPlan(recommendedModules);
  const storeModeLabel = getRecommendedStoreModeLabel(recommendedStoreMode);
  const dataModeLabel = getRecommendedDataModeLabel(recommendedDataMode);
  const industryLabel = getIndustryLabel(normalizedInput.industryType);
  const availableDataLabels = getAvailableDataLabels(normalizedInput.availableData);
  const summarized = summarizeDiagnosisInput(normalizedInput);
  const coreBottlenecks = buildCoreBottlenecks(normalizedInput, storeModeLabel, dataModeLabel, availableDataLabels);
  const recommendedStrategies = buildRecommendedStrategies(normalizedInput, storeModeLabel, dataModeLabel, recommendedModules);
  const revenueOpportunities = buildRevenueOpportunities(normalizedInput, recommendedModules);
  const immediateActions = buildImmediateActions(storeModeLabel, dataModeLabel, recommendedModules, recommendedQuestions);
  const score = calculateScore(normalizedInput, recommendedModules, recommendedStoreMode, recommendedDataMode);

  return {
    analysisBasis: buildAnalysisBasis(normalizedInput),
    coreBottlenecks,
    expansionFeatures: featureExpansionCopy(recommendedModules),
    immediateActions,
    limitationsNote: buildLimitationsNote(),
    recommendedDataMode,
    recommendedModules,
    recommendedPlan,
    recommendedQuestions,
    recommendedStoreMode,
    recommendedStrategies,
    reportSummary: `${normalizedInput.region} ${industryLabel} 매장에는 ${storeModeLabel} + ${dataModeLabel} 구조가 적합합니다. ${summarized.operatingConcerns} 흐름을 기준으로 ${getFeatureLabel(recommendedModules[0])}부터 도입하는 시나리오를 권장합니다.`,
    revenueOpportunities,
    score,
    suggestedFeatures: recommendedModules,
    summary: `${normalizedInput.region} ${industryLabel} 운영에서는 ${getConcernLabel(normalizedInput.currentConcern)} 문제가 먼저 보입니다. 목표인 ${getDesiredOutcomeLabel(normalizedInput.desiredOutcome)}를 빠르게 확인하려면 ${storeModeLabel} 구조로 정리하고 ${availableDataLabels.join(', ')} 데이터를 ${dataModeLabel} 방식으로 묶는 것이 적합합니다.`,
  };
}

export function buildDiagnosisPrompt(input: DiagnosisInput) {
  const normalizedInput = diagnosisInputSchema.parse(input);
  const availableDataLabels = getAvailableDataLabels(normalizedInput.availableData);

  return [
    'You are preparing a structured Korean diagnosis for a small business SaaS onboarding flow.',
    'Use only the provided inputs. Do not claim access to live POS, reservation, payment, or external market data.',
    'Apply deterministic, owner-friendly reasoning and return concise practical output.',
    'Return JSON only with these keys:',
    'score, summary, coreBottlenecks, recommendedStrategies, revenueOpportunities, immediateActions, expansionFeatures, reportSummary, suggestedFeatures, recommendedModules, recommendedQuestions, recommendedStoreMode, recommendedDataMode, recommendedPlan',
    `업종: ${getIndustryLabel(normalizedInput.industryType)}`,
    `지역: ${normalizedInput.region}`,
    `현재 운영 방식 선택: ${normalizedInput.storeModeSelection === 'not_sure' ? '아직 모르겠음' : getRecommendedStoreModeLabel(normalizedInput.storeModeSelection)}`,
    `현재 고민: ${getConcernLabel(normalizedInput.currentConcern)}`,
    `보유 데이터: ${availableDataLabels.join(', ')}`,
    `원하는 결과: ${getDesiredOutcomeLabel(normalizedInput.desiredOutcome)}`,
  ].join('\n');
}

export function normalizeDiagnosisResult(
  candidate: DiagnosisModelDraft,
  input: DiagnosisInput,
  analysisSource: DiagnosisAnalysisSource,
): DiagnosisResult {
  const normalizedInput = diagnosisInputSchema.parse(input);
  const fallback = createFallbackDiagnosisSeed(normalizedInput);
  const parsedCandidate = diagnosisModelDraftSchema.safeParse(candidate);
  const draft = parsedCandidate.success ? parsedCandidate.data : {};
  const recommendedStoreMode = draft.recommendedStoreMode ?? fallback.recommendedStoreMode;
  const recommendedDataMode = draft.recommendedDataMode ?? fallback.recommendedDataMode;
  const recommendedModules = fillFeatureKeys(draft.recommendedModules ?? draft.suggestedFeatures, fallback.recommendedModules);
  const suggestedFeatures = recommendedModules;
  const recommendedQuestions = fillStringArray(draft.recommendedQuestions, fallback.recommendedQuestions, 4);
  const recommendedPlan =
    draft.recommendedPlan === 'free' || draft.recommendedPlan === 'pro' || draft.recommendedPlan === 'vip'
      ? draft.recommendedPlan
      : deriveRecommendedPlan(recommendedModules);

  return {
    analysisBasis: fallback.analysisBasis,
    analysisSource,
    coreBottlenecks: fillStringArray(draft.coreBottlenecks, fallback.coreBottlenecks),
    expansionFeatures: fillStringArray(draft.expansionFeatures, featureExpansionCopy(recommendedModules)),
    immediateActions: fillStringArray(draft.immediateActions, fallback.immediateActions),
    limitationsNote: fallback.limitationsNote,
    recommendedDataMode,
    recommendedModules,
    recommendedPlan,
    recommendedQuestions,
    recommendedStoreMode,
    recommendedStrategies: fillStringArray(draft.recommendedStrategies, fallback.recommendedStrategies),
    reportSummary:
      typeof draft.reportSummary === 'string' && compactText(draft.reportSummary) ? compactText(draft.reportSummary) : fallback.reportSummary,
    revenueOpportunities: fillStringArray(draft.revenueOpportunities, fallback.revenueOpportunities),
    score: clampScore(draft.score, fallback.score),
    suggestedFeatures,
    summary: typeof draft.summary === 'string' && compactText(draft.summary) ? compactText(draft.summary) : fallback.summary,
  };
}

function mapLegacyIndustryType(value: string): DiagnosisInput['industryType'] {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return DEFAULT_DIAGNOSIS_INPUT.industryType;
  if (normalized.includes('뷔페')) return 'korean_buffet';
  if (normalized.includes('주점') || normalized.includes('이자카야') || normalized.includes('술')) return 'pub';
  if (normalized.includes('카페') || normalized.includes('베이커리') || normalized.includes('디저트')) return 'cafe';
  if (normalized.includes('서비스') || normalized.includes('상담')) return 'service';
  if (normalized.includes('식당') || normalized.includes('레스토랑') || normalized.includes('브런치') || normalized.includes('고깃집')) return 'restaurant';

  return 'other';
}

function mapLegacyConcern(value: string): DiagnosisInput['currentConcern'] {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('브랜드') || normalized.includes('첫 화면')) return 'brand_identity';
  if (normalized.includes('문의') || normalized.includes('예약')) return 'slow_inquiries';
  if (normalized.includes('피크') || normalized.includes('대기') || normalized.includes('점심') || normalized.includes('웨이팅')) {
    return 'busy_peak_ops';
  }
  if (normalized.includes('메뉴') || normalized.includes('추가 주문') || normalized.includes('객단가') || normalized.includes('주문')) {
    return 'menu_response';
  }
  if (normalized.includes('응대') || normalized.includes('서비스') || normalized.includes('재방문')) return 'service_quality';

  return 'unknown_customer_reaction';
}

function mapLegacyOutcome(value: string): DiagnosisInput['desiredOutcome'] {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('브랜드') || normalized.includes('문의')) return 'brand_growth';
  if (normalized.includes('메뉴') || normalized.includes('주문')) return 'menu_analysis';
  if (normalized.includes('운영') || normalized.includes('피크') || normalized.includes('대기')) return 'operations_analysis';
  if (normalized.includes('재방문') || normalized.includes('서비스') || normalized.includes('응대')) return 'service_improvement';

  return 'customer_sentiment';
}

function normalizeStoredDiagnosisInput(raw: unknown): DiagnosisInput {
  const parsed = diagnosisInputSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DIAGNOSIS_INPUT, availableData: [...DEFAULT_DIAGNOSIS_INPUT.availableData] };
  }

  const legacy = raw as Partial<Record<string, unknown>>;

  return {
    availableData: [...DEFAULT_DIAGNOSIS_INPUT.availableData],
    currentConcern: mapLegacyConcern(typeof legacy.operatingConcerns === 'string' ? legacy.operatingConcerns : ''),
    desiredOutcome: mapLegacyOutcome(typeof legacy.customerType === 'string' ? legacy.customerType : ''),
    industryType: mapLegacyIndustryType(typeof legacy.businessType === 'string' ? legacy.businessType : ''),
    region: typeof legacy.region === 'string' && legacy.region.trim() ? legacy.region.trim() : DEFAULT_DIAGNOSIS_INPUT.region,
    storeModeSelection: DEFAULT_DIAGNOSIS_INPUT.storeModeSelection,
  };
}

function normalizeStoredDiagnosisResult(raw: unknown, input: DiagnosisInput): DiagnosisResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = (raw as Partial<Record<'analysisSource', unknown>>).analysisSource === 'gpt' ? 'gpt' : 'fallback';
  return normalizeDiagnosisResult(raw as DiagnosisModelDraft, input, source);
}

export function createInitialOnboardingFlowState(): OnboardingFlowState {
  return {
    step: 'diagnosis',
    diagnosisInput: {
      ...DEFAULT_DIAGNOSIS_INPUT,
      availableData: [...DEFAULT_DIAGNOSIS_INPUT.availableData],
    },
    diagnosisResult: null,
    requestDraft: buildRequestDraftFromDiagnosis(DEFAULT_DIAGNOSIS_INPUT),
    requestWizardStep: 'basic',
    selectedPlan: 'free',
    paymentStatus: 'idle',
    activationStatus: 'idle',
  };
}

export function applyOnboardingSetupRequestSaved(state: OnboardingFlowState, requestId: string): OnboardingFlowState {
  return {
    ...state,
    requestId,
    step: 'payment',
  };
}

export function buildDiagnosisResult(
  input: DiagnosisInput,
  analysisSource: DiagnosisAnalysisSource = 'fallback',
): DiagnosisResult {
  return normalizeDiagnosisResult(createFallbackDiagnosisSeed(input), input, analysisSource);
}

export function buildRequestDraftFromDiagnosis(
  input: DiagnosisInput,
  diagnosisResult?: Pick<DiagnosisResult, 'recommendedDataMode' | 'recommendedModules' | 'recommendedStoreMode'>,
): StoreRequestDraft {
  const recommendedStoreMode = diagnosisResult?.recommendedStoreMode ?? recommendStoreMode(input);
  const recommendedDataMode = diagnosisResult?.recommendedDataMode ?? recommendDataMode(input);
  const selectedFeatures = diagnosisResult?.recommendedModules ?? recommendModules(input, recommendedStoreMode, recommendedDataMode);
  const previewTarget = derivePreviewTarget(recommendedStoreMode);
  const industryLabel = getIndustryLabel(input.industryType);

  return {
    address: input.region,
    brandName: '',
    dataMode: recommendedDataMode,
    description: `${input.region} ${industryLabel} 매장의 운영 흐름과 고객 반응을 직관적으로 보여주는 공개 스토어입니다.`,
    storeName: '',
    ownerName: '',
    phone: '',
    email: '',
    businessType: getIndustryLabel(input.industryType),
    mobileCtaLabel: deriveMobileCtaLabel(previewTarget),
    openingHours: '매일 10:00 - 21:00',
    previewTarget,
    primaryCtaLabel: derivePrimaryCtaLabel(previewTarget),
    publicStatus: 'public',
    region: input.region,
    requestedSlug: '',
    selectedFeatures,
    storeMode: recommendedStoreMode,
    tagline: `${industryLabel} 운영 흐름을 한눈에 보여주는 스토어`,
    themePreset: derivePublicTheme(input.industryType),
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

    const initialState = createInitialOnboardingFlowState();
    const parsed = JSON.parse(raw) as Partial<OnboardingFlowState> & { diagnosisInput?: unknown; diagnosisResult?: unknown };
    const diagnosisInput = normalizeStoredDiagnosisInput(parsed.diagnosisInput);
    const diagnosisResult = normalizeStoredDiagnosisResult(parsed.diagnosisResult, diagnosisInput);

    return {
      ...initialState,
      ...parsed,
      diagnosisInput,
      diagnosisResult,
      requestDraft: {
        ...initialState.requestDraft,
        ...parsed.requestDraft,
        address: parsed.requestDraft?.address?.trim() || parsed.requestDraft?.region?.trim() || diagnosisInput.region,
        businessType: parsed.requestDraft?.businessType?.trim() || getIndustryLabel(diagnosisInput.industryType),
        region: parsed.requestDraft?.region?.trim() || diagnosisInput.region,
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
