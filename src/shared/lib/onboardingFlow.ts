import type { BillingPlanCode } from '@/shared/lib/billingPlans';
import { slugifyStoreName } from '@/shared/lib/storeSlug';
import type { FeatureKey } from '@/shared/types/models';

const STORAGE_KEY = 'mybizlab:onboarding-flow';

export type OnboardingStep = 'diagnosis' | 'result' | 'request' | 'payment' | 'activation';
export type OnboardingPaymentStatus = 'idle' | 'processing' | 'paid' | 'failed';
export type OnboardingActivationStatus = 'idle' | 'processing' | 'completed';

export interface DiagnosisInput {
  businessType: string;
  region: string;
  customerType: string;
  operatingConcerns: string;
}

export interface DiagnosisResult {
  score: number;
  summary: string;
  recommendedStrategies: string[];
  revenueOpportunities: string[];
  suggestedFeatures: FeatureKey[];
  recommendedPlan: BillingPlanCode;
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

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
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

export function buildDiagnosisResult(input: DiagnosisInput): DiagnosisResult {
  const businessType = input.businessType.trim() || '매장';
  const region = input.region.trim() || '지역 상권';
  const customerType = input.customerType.trim() || '방문 고객';
  const concerns = normalizeText(input.operatingConcerns);
  const featurePool: FeatureKey[] = ['ai_manager', 'sales_analysis', 'order_management', 'table_order'];
  const strategies: string[] = [];
  const revenueOpportunities: string[] = [];
  let score = 64;

  if (includesAny(concerns, ['예약', '대기', '피크'])) {
    featurePool.push('reservation_management', 'waiting_board');
    strategies.push(`${region} 피크 시간대 예약 흐름을 정리해 대기 손실을 줄이세요.`);
    revenueOpportunities.push('예약 전환 문구와 좌석 운영을 조정하면 피크 시간 매출을 더 받을 수 있습니다.');
    score += 7;
  }

  if (includesAny(concerns, ['단골', '재방문', 'crm', '고객'])) {
    featurePool.push('customer_management', 'ai_business_report');
    strategies.push(`${customerType} 중심으로 재방문 캠페인을 설계해 단골 비중을 높이세요.`);
    revenueOpportunities.push('고객 세분화 쿠폰과 재방문 알림을 적용하면 반복 매출을 키울 수 있습니다.');
    score += 8;
  }

  if (includesAny(concerns, ['주문', '배달', '객단가', '메뉴'])) {
    featurePool.push('sales_analysis');
    strategies.push(`${businessType} 대표 메뉴와 추가 주문 동선을 묶어 객단가를 올리세요.`);
    revenueOpportunities.push('세트 제안과 인기 메뉴 추천을 함께 쓰면 객단가 개선 여지가 큽니다.');
    score += 6;
  }

  if (includesAny(concerns, ['매출', '분석', '비용', '마진'])) {
    featurePool.push('ai_business_report');
    strategies.push('AI 운영 리포트로 매출 흐름과 개선 우선순위를 주 단위로 점검하세요.');
    revenueOpportunities.push('매출 추이와 운영 이슈를 한 화면에서 보면 빠른 의사결정이 가능합니다.');
    score += 5;
  }

  if (includesAny(normalizeText(customerType), ['직장인', '점심', '오피스'])) {
    score += 3;
  }

  if (includesAny(normalizeText(businessType), ['브런치', '레스토랑', '고깃집', '식당'])) {
    featurePool.push('reservation_management');
    score += 4;
  }

  if (input.operatingConcerns.trim().length >= 24) {
    score += 3;
  }

  while (strategies.length < 3) {
    const fallbackStrategies = [
      `${businessType} 고객 흐름을 한 화면에서 보고 운영 우선순위를 정리하세요.`,
      `${region} 상권 기준으로 피크 시간 주문과 예약 패턴을 함께 관리하세요.`,
      'AI 진단 결과를 기준으로 이번 주 실행할 운영 개선 항목 3가지를 먼저 정하세요.',
    ];
    strategies.push(fallbackStrategies[strategies.length]);
  }

  while (revenueOpportunities.length < 3) {
    const fallbackPoints = [
      '고객 재방문 관리와 예약 전환율 개선이 가장 빠른 성장 포인트입니다.',
      '주문 흐름과 매출 데이터를 함께 보면 운영 병목을 더 빠르게 찾을 수 있습니다.',
      'AI 운영 리포트를 기반으로 주간 실행 항목을 반복하면 매출 개선 속도가 높아집니다.',
    ];
    revenueOpportunities.push(fallbackPoints[revenueOpportunities.length]);
  }

  const suggestedFeatures = uniqueValues(featurePool);
  const recommendedPlan: BillingPlanCode =
    suggestedFeatures.length >= 6 ? 'business' : suggestedFeatures.length >= 5 ? 'pro' : 'starter';
  const boundedScore = Math.max(58, Math.min(93, score));

  return {
    score: boundedScore,
    summary: `${region} ${businessType} 운영 데이터를 기준으로 보면 ${customerType} 흐름을 더 정교하게 관리할수록 매출 개선 여지가 큽니다.`,
    recommendedStrategies: strategies.slice(0, 3),
    revenueOpportunities: revenueOpportunities.slice(0, 3),
    suggestedFeatures,
    recommendedPlan,
  };
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
  return slugifyStoreName(storeName);
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
