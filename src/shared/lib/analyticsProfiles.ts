import { DEFAULT_STORE_PRIORITY_WEIGHTS, getStoreBrandConfig } from '@/shared/lib/storeData';
import type { AnalyticsPreset, Store, StorePriorityWeights } from '@/shared/types/models';

type AnalyticsStoreInput = Pick<Store, 'id' | 'slug' | 'business_type'> & Partial<Pick<Store, 'brand_config'>>;

export interface AnalyticsProfileDefinition {
  preset: AnalyticsPreset;
  label: string;
  industry: string;
  region: string;
  customerFocus: string;
  baseDailyOrders: number;
  averageOrderValue: number;
  weekdayRevenueMultipliers: [number, number, number, number, number, number, number];
  weekdayOrderMultipliers: [number, number, number, number, number, number, number];
  reservationShare: number;
  noShowRateBase: number;
  consultationBase: number;
  consultationConversionBase: number;
  reviewBase: number;
  reviewResponseRateBase: number;
  repeatRateBase: number;
  operationsScoreBase: number;
  topSignalTemplates: [string, string, string];
}

export const DEFAULT_PRIORITY_WEIGHTS: StorePriorityWeights = DEFAULT_STORE_PRIORITY_WEIGHTS;

export const ANALYTICS_PROFILE_DEFINITIONS: Record<AnalyticsPreset, AnalyticsProfileDefinition> = {
  seongsu_brunch_cafe: {
    preset: 'seongsu_brunch_cafe',
    label: '성수 브런치형 카페',
    industry: '브런치 카페',
    region: '서울 성동구 성수',
    customerFocus: '평일 직장인 점심 + 주말 데이트 방문',
    baseDailyOrders: 58,
    averageOrderValue: 18900,
    weekdayRevenueMultipliers: [0.92, 0.94, 0.98, 1.02, 1.08, 1.28, 1.24],
    weekdayOrderMultipliers: [0.94, 0.96, 1.01, 1.04, 1.1, 1.22, 1.18],
    reservationShare: 0.18,
    noShowRateBase: 0.07,
    consultationBase: 3,
    consultationConversionBase: 0.38,
    reviewBase: 4,
    reviewResponseRateBase: 0.82,
    repeatRateBase: 0.32,
    operationsScoreBase: 78,
    topSignalTemplates: ['점심 주문 집중', '주말 브런치 예약 유입', '재방문 고객 비중 안정'],
  },
  mapo_evening_restaurant: {
    preset: 'mapo_evening_restaurant',
    label: '마포 저녁형 외식',
    industry: '고깃집',
    region: '서울 마포구 합정/망원권',
    customerFocus: '저녁 회식 + 예약 중심 방문',
    baseDailyOrders: 32,
    averageOrderValue: 39500,
    weekdayRevenueMultipliers: [0.82, 0.9, 0.98, 1.06, 1.18, 1.34, 1.16],
    weekdayOrderMultipliers: [0.8, 0.88, 0.96, 1.02, 1.14, 1.28, 1.1],
    reservationShare: 0.34,
    noShowRateBase: 0.1,
    consultationBase: 2,
    consultationConversionBase: 0.29,
    reviewBase: 3,
    reviewResponseRateBase: 0.74,
    repeatRateBase: 0.27,
    operationsScoreBase: 73,
    topSignalTemplates: ['저녁 예약 비중 높음', '주말 객단가 상승', '노쇼 방지 리마인드 필요'],
  },
  consultation_service: {
    preset: 'consultation_service',
    label: '상담전환형 서비스업',
    industry: '상담형 서비스업',
    region: '서울 강남권',
    customerFocus: '상담 리드 유입 후 예약/계약 전환',
    baseDailyOrders: 9,
    averageOrderValue: 128000,
    weekdayRevenueMultipliers: [0.9, 0.97, 1.04, 1.08, 1.1, 0.86, 0.74],
    weekdayOrderMultipliers: [0.88, 0.94, 1.02, 1.08, 1.1, 0.9, 0.78],
    reservationShare: 0.26,
    noShowRateBase: 0.05,
    consultationBase: 8,
    consultationConversionBase: 0.44,
    reviewBase: 2,
    reviewResponseRateBase: 0.9,
    repeatRateBase: 0.46,
    operationsScoreBase: 81,
    topSignalTemplates: ['상담 후 예약 전환 추적', '평일 오후 리드 집중', '후속 응대 SLA 중요'],
  },
};

const STORE_PRESET_BY_ID: Record<string, AnalyticsPreset> = {
  store_golden_coffee: 'seongsu_brunch_cafe',
  store_mint_bbq: 'mapo_evening_restaurant',
  store_seoul_buffet: 'mapo_evening_restaurant',
};

export function getAnalyticsProfileDefinition(preset: AnalyticsPreset) {
  return ANALYTICS_PROFILE_DEFINITIONS[preset];
}

export function resolveAnalyticsPresetForStore(input: AnalyticsStoreInput) {
  if (STORE_PRESET_BY_ID[input.id]) {
    return STORE_PRESET_BY_ID[input.id];
  }

  const config = getStoreBrandConfig(input);
  const normalized = `${config.business_type} ${input.slug || ''}`.toLowerCase();

  if (normalized.includes('bbq') || normalized.includes('izakaya') || normalized.includes('buffet') || normalized.includes('korean_buffet')) {
    return 'mapo_evening_restaurant';
  }

  if (normalized.includes('consult') || normalized.includes('clinic') || normalized.includes('service')) {
    return 'consultation_service';
  }

  return 'seongsu_brunch_cafe';
}
