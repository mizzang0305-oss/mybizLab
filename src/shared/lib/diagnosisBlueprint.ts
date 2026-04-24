import type { FeatureKey } from '../types/models.js';

export type DiagnosisSelectedStoreMode = 'order_first' | 'survey_first' | 'hybrid' | 'brand_inquiry_first' | 'not_sure';
export type DiagnosisRecommendedStoreMode = Exclude<DiagnosisSelectedStoreMode, 'not_sure'>;
export type DiagnosisAvailableDataKey = 'order_data' | 'pos_sales' | 'no_feedback' | 'reservation_inquiry' | 'manual_notes';
export type DiagnosisDesiredOutcomeKey =
  | 'customer_sentiment'
  | 'service_improvement'
  | 'menu_analysis'
  | 'operations_analysis'
  | 'brand_growth';
export type DiagnosisDataMode = 'order_only' | 'survey_only' | 'manual_only' | 'order_survey' | 'survey_manual' | 'order_survey_manual';

export const DIAGNOSIS_INDUSTRY_OPTIONS = [
  { description: '주간 메뉴와 점심 피크 운영이 중요한 매장', label: '한식 뷔페', value: 'korean_buffet' },
  { description: '예약, 주문, 재방문 관리를 함께 보는 일반 식당', label: '일반 식당', value: 'restaurant' },
  { description: '야간 피크와 문의 응대가 많은 주점형 매장', label: '주점 / 이자카야', value: 'pub' },
  { description: '메뉴 반응과 재방문 고객 경험이 중요한 카페형 매장', label: '카페 / 베이커리', value: 'cafe' },
  { description: '문의, 예약, 후기 중심으로 운영되는 서비스업', label: '서비스업', value: 'service' },
  { description: '표준 업종 분류에 딱 맞지 않는 기타 업종', label: '기타', value: 'other' },
] as const;

export const DIAGNOSIS_STORE_MODE_OPTIONS = [
  { description: '주문 흐름과 메뉴 반응을 먼저 보고 싶음', label: '주문 중심', value: 'order_first' },
  { description: '설문과 응대 품질을 먼저 보고 싶음', label: '설문 중심', value: 'survey_first' },
  { description: '주문과 설문을 함께 보고 싶음', label: '혼합형', value: 'hybrid' },
  { description: '브랜드 소개와 문의 유입을 먼저 만들고 싶음', label: '브랜드/문의 중심', value: 'brand_inquiry_first' },
  { description: '아직 어떤 흐름이 맞는지 잘 모르겠음', label: '아직 모르겠음', value: 'not_sure' },
] as const;

export const DIAGNOSIS_CONCERN_OPTIONS = [
  { description: '고객 반응을 잘 모르겠어서 감으로 운영 중', label: '손님 반응을 잘 모르겠다', value: 'unknown_customer_reaction' },
  { description: '응대 품질이나 서비스 피드백이 부족함', label: '서비스/응대 품질이 걱정된다', value: 'service_quality' },
  { description: '피크 타임 운영과 대기 흐름이 자주 꼬임', label: '피크 시간 운영이 자주 꼬인다', value: 'busy_peak_ops' },
  { description: '메뉴별 반응과 추가 주문 유도가 약함', label: '메뉴 반응과 추가 주문이 약하다', value: 'menu_response' },
  { description: '문의와 예약 응답이 늦어지는 편', label: '문의 응답이 늦어지고 있다', value: 'slow_inquiries' },
  { description: '브랜드 메시지와 첫 화면 설득력이 약함', label: '브랜드 메시지가 약하다', value: 'brand_identity' },
] as const;

export const DIAGNOSIS_AVAILABLE_DATA_OPTIONS = [
  { description: '주문/클릭 데이터가 이미 어느 정도 있음', label: '주문 데이터 있음', value: 'order_data' },
  { description: 'POS 매출 숫자만 있고 고객 맥락은 부족함', label: 'POS 매출만 있음', value: 'pos_sales' },
  { description: '고객 피드백이나 설문 데이터가 거의 없음', label: '고객 피드백이 거의 없음', value: 'no_feedback' },
  { description: '예약/문의 기록은 있지만 운영 해석이 어려움', label: '예약/문의 기록만 있음', value: 'reservation_inquiry' },
  { description: '사장님 메모나 수기 운영 기록은 남기고 있음', label: '수기 메모는 있음', value: 'manual_notes' },
] as const;

export const DIAGNOSIS_DESIRED_OUTCOME_OPTIONS = [
  { description: '고객 만족과 불만 포인트를 먼저 파악하고 싶음', label: '손님 만족/불만을 알고 싶다', value: 'customer_sentiment' },
  { description: '응대 품질과 재방문 경험을 개선하고 싶음', label: '서비스 품질을 개선하고 싶다', value: 'service_improvement' },
  { description: '메뉴 반응과 구성 개선 포인트를 알고 싶음', label: '메뉴 반응을 분석하고 싶다', value: 'menu_analysis' },
  { description: '운영 병목과 피크 타임 문제를 찾고 싶음', label: '운영 문제를 분석하고 싶다', value: 'operations_analysis' },
  { description: '브랜드 소개와 문의 전환력을 높이고 싶음', label: '브랜드/첫 화면을 강화하고 싶다', value: 'brand_growth' },
] as const;

const storeModeLabelMap: Record<DiagnosisRecommendedStoreMode, string> = {
  brand_inquiry_first: '브랜드/문의 중심',
  hybrid: '혼합형',
  order_first: '주문 중심',
  survey_first: '설문 중심',
};

const dataModeLabelMap: Record<DiagnosisDataMode, string> = {
  manual_only: '수기 데이터 중심',
  order_only: '주문 데이터 중심',
  order_survey: '주문 + 설문 결합',
  order_survey_manual: '주문 + 설문 + 수기 결합',
  survey_manual: '설문 + 수기 결합',
  survey_only: '설문 데이터 중심',
};

function optionLabel<T extends string>(options: readonly { label: string; value: T }[], value: T) {
  return options.find((item) => item.value === value)?.label || value;
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

export function getIndustryLabel(industryType: string) {
  return optionLabel(DIAGNOSIS_INDUSTRY_OPTIONS, industryType as (typeof DIAGNOSIS_INDUSTRY_OPTIONS)[number]['value']);
}

export function getConcernLabel(currentConcern: string) {
  return optionLabel(DIAGNOSIS_CONCERN_OPTIONS, currentConcern as (typeof DIAGNOSIS_CONCERN_OPTIONS)[number]['value']);
}

export function getDesiredOutcomeLabel(desiredOutcome: string) {
  return optionLabel(DIAGNOSIS_DESIRED_OUTCOME_OPTIONS, desiredOutcome as (typeof DIAGNOSIS_DESIRED_OUTCOME_OPTIONS)[number]['value']);
}

export function getSelectedStoreModeLabel(storeModeSelection: DiagnosisSelectedStoreMode) {
  return optionLabel(DIAGNOSIS_STORE_MODE_OPTIONS, storeModeSelection);
}

export function getRecommendedStoreModeLabel(storeMode: DiagnosisRecommendedStoreMode) {
  return storeModeLabelMap[storeMode];
}

export function getRecommendedDataModeLabel(dataMode: DiagnosisDataMode) {
  return dataModeLabelMap[dataMode];
}

export function getAvailableDataLabels(values: DiagnosisAvailableDataKey[]) {
  return values.map((value) =>
    optionLabel(DIAGNOSIS_AVAILABLE_DATA_OPTIONS, value as (typeof DIAGNOSIS_AVAILABLE_DATA_OPTIONS)[number]['value']),
  );
}

export interface StructuredDiagnosisInputLike {
  availableData: DiagnosisAvailableDataKey[];
  currentConcern: string;
  desiredOutcome: string;
  industryType: string;
  storeModeSelection: DiagnosisSelectedStoreMode;
}

export function summarizeDiagnosisInput(input: StructuredDiagnosisInputLike) {
  const businessType = getIndustryLabel(input.industryType);
  const customerType = getDesiredOutcomeLabel(input.desiredOutcome);
  const operatingConcerns = [
    getConcernLabel(input.currentConcern),
    `현재 운영 모드: ${getSelectedStoreModeLabel(input.storeModeSelection)}`,
    `보유 데이터: ${getAvailableDataLabels(input.availableData).join(', ')}`,
  ].join(' / ');

  return {
    businessType,
    customerType,
    operatingConcerns,
  };
}

export function recommendStoreMode(input: StructuredDiagnosisInputLike): DiagnosisRecommendedStoreMode {
  const hasOrderData = input.availableData.includes('order_data');
  const wantsSurvey =
    input.desiredOutcome === 'customer_sentiment' ||
    input.desiredOutcome === 'service_improvement' ||
    input.currentConcern === 'unknown_customer_reaction' ||
    input.currentConcern === 'service_quality';
  const wantsBrand = input.desiredOutcome === 'brand_growth' || input.currentConcern === 'brand_identity' || input.currentConcern === 'slow_inquiries';

  if (input.storeModeSelection !== 'not_sure') {
    if (input.storeModeSelection === 'hybrid') {
      return 'hybrid';
    }

    if (input.storeModeSelection === 'brand_inquiry_first' && !wantsBrand) {
      return hasOrderData && wantsSurvey ? 'hybrid' : hasOrderData ? 'order_first' : 'survey_first';
    }

    if (input.storeModeSelection === 'order_first' && wantsSurvey && !hasOrderData) {
      return 'survey_first';
    }

    if (input.storeModeSelection === 'survey_first' && hasOrderData && input.desiredOutcome === 'menu_analysis') {
      return 'hybrid';
    }

    return input.storeModeSelection;
  }

  if (wantsBrand) {
    return 'brand_inquiry_first';
  }

  if (hasOrderData && wantsSurvey) {
    return 'hybrid';
  }

  if (wantsSurvey) {
    return 'survey_first';
  }

  return 'order_first';
}

export function recommendDataMode(input: StructuredDiagnosisInputLike): DiagnosisDataMode {
  const hasOrderData = input.availableData.includes('order_data');
  const hasManualData = input.availableData.includes('manual_notes') || input.availableData.includes('pos_sales');
  const needsSurveyData =
    input.desiredOutcome === 'customer_sentiment' ||
    input.desiredOutcome === 'service_improvement' ||
    input.currentConcern === 'unknown_customer_reaction' ||
    input.currentConcern === 'service_quality' ||
    input.availableData.includes('reservation_inquiry') ||
    input.availableData.includes('no_feedback');

  if (hasOrderData && needsSurveyData && hasManualData) {
    return 'order_survey_manual';
  }

  if (hasOrderData && needsSurveyData) {
    return 'order_survey';
  }

  if (needsSurveyData && hasManualData) {
    return 'survey_manual';
  }

  if (hasOrderData) {
    return 'order_only';
  }

  if (needsSurveyData) {
    return 'survey_only';
  }

  return 'manual_only';
}

export function recommendModules(
  input: StructuredDiagnosisInputLike,
  recommendedStoreMode: DiagnosisRecommendedStoreMode,
  recommendedDataMode: DiagnosisDataMode,
): FeatureKey[] {
  const modules: FeatureKey[] = ['ai_manager', 'sales_analysis'];

  if (recommendedStoreMode === 'survey_first' || recommendedStoreMode === 'hybrid') {
    modules.push('surveys', 'customer_management');
  }

  if (recommendedStoreMode === 'order_first' || recommendedStoreMode === 'hybrid') {
    modules.push('order_management', 'table_order');
  }

  if (recommendedStoreMode === 'brand_inquiry_first') {
    modules.push('brand_management', 'customer_management');
  }

  if (input.currentConcern === 'busy_peak_ops') {
    modules.push('reservation_management', 'waiting_board');
  }

  if (input.currentConcern === 'slow_inquiries') {
    modules.push('reservation_management');
  }

  if (recommendedDataMode === 'manual_only' || recommendedDataMode === 'survey_manual' || recommendedDataMode === 'order_survey_manual') {
    modules.push('ai_business_report');
  }

  return uniqueValues(modules).slice(0, 6);
}

export function recommendQuestions(input: StructuredDiagnosisInputLike) {
  const industryLabel = getIndustryLabel(input.industryType);

  if (input.desiredOutcome === 'menu_analysis') {
    return [
      `오늘 ${industryLabel}에서 가장 반응이 좋았던 메뉴는 무엇이었나요?`,
      '추가로 있었으면 하는 메뉴나 세트 구성이 있나요?',
      '주문 과정에서 헷갈리거나 오래 걸린 순간이 있었나요?',
      '다음 방문 때 다시 주문하고 싶은 메뉴가 있나요?',
    ];
  }

  if (input.desiredOutcome === 'brand_growth') {
    return [
      `처음 ${industryLabel} 화면을 봤을 때 가장 먼저 이해된 메시지는 무엇이었나요?`,
      '문의나 예약 전에 더 보고 싶었던 정보가 있었나요?',
      '브랜드 분위기나 차별점이 충분히 느껴졌나요?',
      '다른 사람에게 소개하고 싶은 이유가 있다면 무엇인가요?',
    ];
  }

  if (input.desiredOutcome === 'operations_analysis') {
    return [
      '대기나 응대 흐름에서 가장 답답했던 지점은 어디였나요?',
      '예약/문의 답변 속도는 어땠나요?',
      '피크 시간대에 불편을 줄이려면 무엇이 가장 먼저 바뀌어야 하나요?',
      '사장님이 꼭 알아야 할 운영 문제를 하나만 꼽는다면 무엇인가요?',
    ];
  }

  return [
    '오늘 방문에서 가장 만족스러웠던 점은 무엇이었나요?',
    '불편하거나 개선이 필요했던 순간이 있었나요?',
    '직원 응대나 안내는 이해하기 쉬웠나요?',
    `다음에도 ${industryLabel}를 다시 찾고 싶은 이유가 있나요?`,
  ];
}
