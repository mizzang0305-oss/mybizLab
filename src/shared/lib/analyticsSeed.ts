import { ANALYTICS_PROFILE_DEFINITIONS, DEFAULT_PRIORITY_WEIGHTS, getAnalyticsProfileDefinition, resolveAnalyticsPresetForStore } from '@/shared/lib/analyticsProfiles';
import { startOfDayKey } from '@/shared/lib/format';
import type {
  AnalyticsPreset,
  Store,
  StoreAnalyticsProfile,
  StoreDailyMetric,
  StorePrioritySettings,
  StorePriorityWeights,
} from '@/shared/types/models';

type AnalyticsStoreInput = Pick<Store, 'id' | 'slug' | 'business_type'> & Partial<Pick<Store, 'brand_config'>>;

function isoDateDaysAgo(daysAgo: number) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(9, 0, 0, 0);
  return value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}

function hashSeed(input: string) {
  return input.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
}

function createStoreFactor(storeId: string) {
  return (hashSeed(storeId) % 7) * 0.012;
}

function createTrendFactor(index: number, storeFactor: number) {
  const weeklyPulse = ((index % 5) - 2) * 0.018;
  const monthlyPulse = (((Math.floor(index / 7) + hashSeed(`${storeFactor}`)) % 4) - 1.5) * 0.022;
  return 1 + weeklyPulse + monthlyPulse + storeFactor;
}

function createPriorityWeightsForPreset(preset: AnalyticsPreset): StorePriorityWeights {
  if (preset === 'mapo_evening_restaurant') {
    return {
      revenue: 30,
      repeatCustomers: 12,
      reservations: 20,
      consultationConversion: 8,
      branding: 10,
      orderEfficiency: 20,
    };
  }

  if (preset === 'consultation_service') {
    return {
      revenue: 18,
      repeatCustomers: 18,
      reservations: 10,
      consultationConversion: 28,
      branding: 16,
      orderEfficiency: 10,
    };
  }

  return DEFAULT_PRIORITY_WEIGHTS;
}

function buildSignals(input: {
  preset: AnalyticsPreset;
  reservationCount: number;
  noShowRate: number;
  consultationCount: number;
  repeatRate: number;
  operationsScore: number;
}) {
  const profile = getAnalyticsProfileDefinition(input.preset);
  const signals = [profile.topSignalTemplates[0], profile.topSignalTemplates[1], profile.topSignalTemplates[2]];

  if (input.noShowRate >= 0.09) {
    signals[2] = '노쇼 관리와 리마인드 메시지 우선';
  } else if (input.consultationCount >= 6) {
    signals[2] = '상담 후 예약 전환 추적 강화';
  } else if (input.repeatRate >= 0.34) {
    signals[2] = '단골 전환 액션 유지 효과 확인';
  } else if (input.operationsScore < 70) {
    signals[2] = '피크타임 운영 효율 점검 필요';
  } else if (input.reservationCount >= 10) {
    signals[2] = '예약 고객 응대 동선 최적화 필요';
  }

  return signals;
}

export function buildStoreAnalyticsProfile(store: AnalyticsStoreInput): StoreAnalyticsProfile {
  const preset = resolveAnalyticsPresetForStore(store);
  const definition = ANALYTICS_PROFILE_DEFINITIONS[preset];

  return {
    id: `analytics_profile_${store.id}`,
    store_id: store.id,
    industry: definition.industry,
    region: definition.region,
    customer_focus: definition.customerFocus,
    analytics_preset: preset,
    updated_at: isoDateDaysAgo(0).toISOString(),
    version: 1,
  };
}

export function buildStorePrioritySettings(storeId: string, preset: AnalyticsPreset): StorePrioritySettings {
  const weights = createPriorityWeightsForPreset(preset);

  return {
    id: `priority_settings_${storeId}`,
    store_id: storeId,
    revenue_weight: weights.revenue,
    repeat_customer_weight: weights.repeatCustomers,
    reservation_weight: weights.reservations,
    consultation_weight: weights.consultationConversion,
    branding_weight: weights.branding,
    order_efficiency_weight: weights.orderEfficiency,
    created_at: isoDateDaysAgo(0).toISOString(),
    updated_at: isoDateDaysAgo(0).toISOString(),
    version: 1,
  };
}

export function buildStoreDailyMetrics(store: AnalyticsStoreInput, days = 120): StoreDailyMetric[] {
  const preset = resolveAnalyticsPresetForStore(store);
  const definition = ANALYTICS_PROFILE_DEFINITIONS[preset];
  const storeFactor = createStoreFactor(store.id);

  return Array.from({ length: days }).map((_, index) => {
    const targetDate = isoDateDaysAgo(days - index - 1);
    const weekday = targetDate.getDay();
    const trendFactor = createTrendFactor(index, storeFactor);
    const orderMultiplier = definition.weekdayOrderMultipliers[weekday];
    const revenueMultiplier = definition.weekdayRevenueMultipliers[weekday];
    const ordersCount = Math.max(4, round(definition.baseDailyOrders * orderMultiplier * trendFactor));
    const avgOrderValue = round(definition.averageOrderValue * (0.97 + (revenueMultiplier / Math.max(orderMultiplier, 0.4)) * 0.03));
    const revenueTotal = round(ordersCount * avgOrderValue);
    const customerCount = Math.max(3, round(ordersCount * (preset === 'consultation_service' ? 0.92 : 0.76)));
    const repeatCustomerRate = clamp(
      definition.repeatRateBase + ((weekday >= 5 ? 0.02 : -0.01) + (index % 6) * 0.003) - storeFactor * 0.4,
      0.14,
      0.62,
    );
    const repeatCustomers = round(customerCount * repeatCustomerRate);
    const newCustomers = Math.max(1, customerCount - repeatCustomers);
    const reservationCount = round(ordersCount * definition.reservationShare * (weekday >= 4 ? 1.18 : 0.92));
    const noShowRate = clamp(definition.noShowRateBase + ((weekday === 5 ? 0.012 : 0) - (weekday === 1 ? 0.006 : 0)), 0.02, 0.18);
    const consultationCount = Math.max(
      0,
      round(definition.consultationBase * (preset === 'consultation_service' ? 1.35 : 1) * (weekday >= 1 && weekday <= 4 ? 1.05 : 0.88)),
    );
    const consultationConversionRate = clamp(
      definition.consultationConversionBase + ((index % 4) - 1.5) * 0.018 + (weekday === 2 ? 0.02 : 0),
      0.16,
      0.68,
    );
    const reviewCount = Math.max(1, round(definition.reviewBase * (weekday >= 5 ? 1.32 : 0.94)));
    const reviewResponseRate = clamp(
      definition.reviewResponseRateBase - (weekday === 6 ? 0.04 : 0) + ((index + weekday) % 3) * 0.012,
      0.45,
      0.98,
    );
    const visitorCount = Math.max(customerCount, round(ordersCount * (preset === 'consultation_service' ? 1.08 : 1.18)));
    const lunchGuestCount = Math.max(0, round(visitorCount * (weekday >= 1 && weekday <= 5 ? 0.58 : 0.44)));
    const dinnerGuestCount = Math.max(0, visitorCount - lunchGuestCount);
    const takeoutCount = Math.max(0, round(ordersCount * (preset === 'mapo_evening_restaurant' ? 0.14 : 0.22)));
    const averageWaitMinutes = clamp(round(9 + (weekday === 5 ? 5 : weekday === 6 ? 3 : 1) + (ordersCount - definition.baseDailyOrders) * 0.12), 4, 28);
    const stockoutFlag = weekday === 5 && index % 5 === 0;
    const note = stockoutFlag
      ? '대표 메뉴 재고가 빠르게 소진되어 리필 동선을 먼저 챙겨야 했습니다.'
      : averageWaitMinutes >= 16
        ? '점심 피크 대기가 길어져 안내 문구 보강이 필요했습니다.'
        : takeoutCount >= 10
          ? '포장 주문 비중이 높아 전용 픽업 동선 안내가 있으면 더 좋았습니다.'
          : '';
    const operationsScore = clamp(
      definition.operationsScoreBase +
        (weekday === 5 ? -2 : 1) +
        repeatCustomerRate * 12 -
        noShowRate * 32 +
        consultationConversionRate * 9,
      58,
      93,
    );

    return {
      id: `daily_metric_${store.id}_${startOfDayKey(targetDate)}`,
      store_id: store.id,
      metric_date: startOfDayKey(targetDate),
      revenue_total: revenueTotal,
      visitor_count: visitorCount,
      lunch_guest_count: lunchGuestCount,
      dinner_guest_count: dinnerGuestCount,
      takeout_count: takeoutCount,
      average_wait_minutes: averageWaitMinutes,
      stockout_flag: stockoutFlag,
      note,
      orders_count: ordersCount,
      avg_order_value: avgOrderValue,
      new_customers: newCustomers,
      repeat_customers: repeatCustomers,
      repeat_customer_rate: round(repeatCustomerRate * 100),
      reservation_count: Math.max(0, reservationCount),
      no_show_rate: round(noShowRate * 100),
      consultation_count: consultationCount,
      consultation_conversion_rate: round(consultationConversionRate * 100),
      review_count: reviewCount,
      review_response_rate: round(reviewResponseRate * 100),
      operations_score: round(operationsScore),
      top_signals: buildSignals({
        preset,
        reservationCount,
        noShowRate,
        consultationCount,
        repeatRate: repeatCustomerRate,
        operationsScore,
      }),
      version: 1,
    };
  });
}

export function buildAnalyticsSeedForStores(stores: AnalyticsStoreInput[]) {
  const profiles = stores.map((store) => buildStoreAnalyticsProfile(store));
  const prioritySettings = stores.map((store) => buildStorePrioritySettings(store.id, resolveAnalyticsPresetForStore(store)));
  const dailyMetrics = stores.flatMap((store) => buildStoreDailyMetrics(store));

  return {
    profiles,
    prioritySettings,
    dailyMetrics,
  };
}
