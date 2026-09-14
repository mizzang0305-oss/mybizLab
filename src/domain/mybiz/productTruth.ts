import type { ServiceVertical } from './serviceOs.js';

export const MYBIZ_PRODUCT_IDENTITY = {
  company: 'MyBizLab',
  product: 'MyBiz',
  category: 'Business Service OS',
  corePromise: '작업부터 다음 고객까지.',
} as const;

export const MYBIZ_CANONICAL_FLOW = [
  'Customer / Lead',
  'Job',
  'optional Contract',
  'Work',
  'Evidence',
  'Customer Confirmation',
  'Payment Tracking',
  'Evidence Package',
  'Channel-specific Consent',
  'Merchant Approval',
  'Brand / Content Asset',
  'Customer Memory',
  'Next Customer',
] as const;

export const SERVICE_OS_CORE_MODULES = [
  'customers',
  'jobs',
  'job status',
  'work history',
  'evidence',
  'media',
  'customer confirmation',
  'business history',
] as const;

export const SERVICE_OS_OPTIONAL_MODULES = [
  'contract',
  'payment tracking',
  'schedule/reservation',
  'customer memory',
  'brand website',
  'media vault',
  'Google Drive sync',
  'content generation',
  'blog workflow',
  'SNS publishing',
  'AI reports',
  'automation',
] as const;

export const SUBSCRIPTION_PLAN_CODES = ['FREE', 'PRO', 'VIP'] as const;
export const BRAND_SITE_TIERS = ['Basic', 'Brand', 'Growth'] as const;

export const PUBLIC_V1_VERTICALS = ['cleaning', 'hair', 'installation'] as const satisfies readonly ServiceVertical[];

export const STORE_ID_COMPATIBILITY_MEANING =
  'legacy-compatible tenant/business/workspace scope identifier';

export const CUSTOMER_MEMORY_DISPOSITION = 'cross-cutting revenue capability';

export const LEGACY_RESTAURANT_CAPABILITIES = [
  'menu',
  'menu_categories',
  'menu_items',
  'orders',
  'order_items',
  'table-order',
  'kitchen',
  'kitchen_tickets',
  'waiting',
  'restaurant reservation',
  'POS compatibility',
] as const;

export const SERVICE_OS_ONBOARDING_QUESTIONS = [
  '어떤 업종인가?',
  '어떤 서비스/작업을 제공하는가?',
  '작업 전후 사진/영상이 필요한가?',
  '고객 결과 확인이 필요한가?',
  '계약/동의가 필요한가?',
  '결제는 어떻게 받는가?',
  '예약/일정 관리가 필요한가?',
  '홈페이지가 필요한가?',
  '포트폴리오가 필요한가?',
  '블로그/SNS 활용이 필요한가?',
  '고객 재방문 기억이 필요한가?',
] as const;

export type OnboardingCapability =
  | 'evidence'
  | 'confirmation'
  | 'contract'
  | 'payment'
  | 'schedule'
  | 'website'
  | 'portfolio'
  | 'content'
  | 'customerMemory';

export type ServiceOsOnboardingAnswers = Record<OnboardingCapability, boolean>;

const OPTIONAL_MODULE_BY_CAPABILITY: Record<OnboardingCapability, readonly string[]> = {
  evidence: ['media vault'],
  confirmation: [],
  contract: ['contract'],
  payment: ['payment tracking'],
  schedule: ['schedule/reservation'],
  website: ['brand website'],
  portfolio: ['brand website'],
  content: ['content generation', 'blog workflow', 'SNS publishing'],
  customerMemory: ['customer memory'],
};

export function recommendOptionalModules(answers: ServiceOsOnboardingAnswers) {
  return Array.from(
    new Set(
      Object.entries(answers).flatMap(([capability, enabled]) =>
        enabled ? OPTIONAL_MODULE_BY_CAPABILITY[capability as OnboardingCapability] : [],
      ),
    ),
  );
}

export function isCommercialTaxonomySeparated() {
  return SUBSCRIPTION_PLAN_CODES.every((plan) => !BRAND_SITE_TIERS.includes(plan as never));
}
