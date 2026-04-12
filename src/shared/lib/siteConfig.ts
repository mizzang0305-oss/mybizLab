export const SITE_NAME = '마이비즈랩';
export const SERVICE_DOMAIN = 'mybiz.ai.kr';
export const SERVICE_TAGLINE = '고객 기억으로 재방문 매출을 만드는 매장 운영 SaaS';
export const SERVICE_DESCRIPTION =
  'MyBizLab은 공개페이지 유입, 문의·AI 상담·예약·웨이팅을 고객 타임라인에 연결하고 다음 행동을 추천해 재방문 매출로 이어주는 매장 운영 SaaS입니다.';
export const POLICY_UPDATED_AT = '2026년 3월 14일';
export const SUPPORT_PHONE_NUMBER = '032-214-5757';
export const SUBSCRIPTION_START_PATH = '/onboarding';

export const BUSINESS_INFO = {
  companyName: '마이비즈랩',
  representative: '이정민',
  businessRegistrationNumber: '741-01-03857',
  ecommerceRegistrationNumber: '2026-인천남동구-0346',
  address: '인천광역시 남동구 만수서로 101, 121-1(만수동, 유한프라자)',
  email: 'mybiz.lab3@gmail.com',
  customerCenter: SUPPORT_PHONE_NUMBER,
} as const;

export const LEGAL_LINKS = [
  { label: '이용약관', href: '/terms' },
  { label: '개인정보처리방침', href: '/privacy' },
  { label: '환불정책', href: '/refund' },
] as const;

export interface PricingPlan {
  name: 'FREE' | 'PRO' | 'VIP';
  priceLabel: string;
  summary: string;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'FREE',
    priceLabel: '월 29,000원',
    summary: '한 매장을 빠르게 시작하는 기본 운영 플랜',
    features: ['AI 스토어 진단', '기본 매출 분석', '주문 관리'],
  },
  {
    name: 'PRO',
    priceLabel: '월 79,000원',
    summary: '고객 관리와 예약 운영까지 함께 보는 추천 플랜',
    features: ['고객 관리', '예약 관리', 'AI 운영 리포트'],
    highlighted: true,
  },
  {
    name: 'VIP',
    priceLabel: '월 149,000원',
    summary: '운영 자동화와 리포트를 깊게 보는 확장 플랜',
    features: ['고급 매출 분석', '통합 운영 관리', '브랜드 확장 준비'],
  },
] as const;
