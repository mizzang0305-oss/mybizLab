import type { ShowroomTemplateId } from './showroomData';

const DEFAULT_BRAND_NAME = '우리 회사';
const DEFAULT_PRIMARY_COLOR = '#EC5B13';
const BRAND_NAME_LIMIT = 40;

export interface BrandPreviewInput {
  automation: string;
  brandName: string;
  industry: string;
  primaryColor: string;
  selectedModules: string[];
  userCount: string;
}
export interface DevelopmentInquiryInput {
  budget: string;
  companyName: string;
  consent: boolean;
  contactName: string;
  coreFeatures: string[];
  currentProblem: string;
  email: string;
  phone: string;
  reference: string;
  systemType: ShowroomTemplateId | '';
  timeline: string;
  userScale: string;
}

export type DevelopmentInquiryErrors = Partial<Record<keyof DevelopmentInquiryInput, string>>;

function normalizeText(value: string, limit: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, limit);
}

function normalizeColor(value: string) {
  return /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : DEFAULT_PRIMARY_COLOR;
}

export function createBrandPreview(input: BrandPreviewInput) {
  const brandName = normalizeText(input.brandName, BRAND_NAME_LIMIT) || DEFAULT_BRAND_NAME;
  const userCount = normalizeText(input.userCount, 8).replace(/[^\d]/g, '') || '5';
  const modules = input.selectedModules.map((item) => normalizeText(item, 30)).filter(Boolean);

  return {
    adminTitle: `${brandName} Admin`,
    automationLabel: normalizeText(input.automation, 80) || '반복 업무 자동화 선택 전',
    brandName,
    industryLabel: normalizeText(input.industry, 30) || '서비스업',
    modules: modules.length > 0 ? [...new Set(modules)] : ['고객관리'],
    primaryColor: normalizeColor(input.primaryColor),
    userLabel: `${userCount}명 사용 예시`,
  };
}

export function validateDevelopmentInquiry(input: DevelopmentInquiryInput): DevelopmentInquiryErrors {
  const errors: DevelopmentInquiryErrors = {};

  if (normalizeText(input.companyName, 80).length < 2) errors.companyName = '회사 또는 브랜드명을 2자 이상 입력해 주세요.';
  if (!input.systemType) errors.systemType = '원하는 시스템을 선택해 주세요.';
  if (normalizeText(input.currentProblem, 500).length < 12) errors.currentProblem = '현재 문제를 12자 이상 알려 주세요.';
  if (input.coreFeatures.length === 0) errors.coreFeatures = '필요한 핵심 기능을 하나 이상 선택해 주세요.';
  if (!input.userScale) errors.userScale = '예상 사용자 규모를 선택해 주세요.';
  if (!input.timeline) errors.timeline = '예상 일정을 선택해 주세요.';
  if (!input.budget) errors.budget = '예상 예산 범위를 선택해 주세요.';
  if (normalizeText(input.contactName, 60).length < 2) errors.contactName = '담당자명을 2자 이상 입력해 주세요.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = '확인 가능한 이메일을 입력해 주세요.';
  if (input.phone.replace(/\D/g, '').length < 9) errors.phone = '확인 가능한 연락처를 입력해 주세요.';
  if (!input.consent) errors.consent = '상담을 위한 개인정보 처리 안내에 동의해 주세요.';

  return errors;
}

export function buildDevelopmentInquiryPayload(input: DevelopmentInquiryInput) {
  const errors = validateDevelopmentInquiry(input);
  if (Object.keys(errors).length > 0) throw new Error('DEVELOPMENT_INQUIRY_INVALID');

  return {
    budget: input.budget,
    companyName: normalizeText(input.companyName, 80),
    consent: { contact: true, marketing: false },
    contact: {
      email: input.email.trim().toLowerCase(),
      name: normalizeText(input.contactName, 60),
      phone: normalizeText(input.phone, 24),
    },
    coreFeatures: [...new Set(input.coreFeatures.map((item) => normalizeText(item, 40)).filter(Boolean))],
    currentProblem: normalizeText(input.currentProblem, 500),
    persistenceStatus: 'not_submitted' as const,
    reference: normalizeText(input.reference, 300),
    source: 'commercial_showroom' as const,
    systemType: input.systemType,
    timeline: input.timeline,
    userScale: input.userScale,
    version: 1 as const,
  };
}
