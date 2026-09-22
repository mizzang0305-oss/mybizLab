import { SHOWROOM_TEMPLATES, type ShowroomTemplateId } from './showroomData';

export const HOMEPAGE_INQUIRY_TYPE = 'homepage-build' as const;

export type DevelopmentInquirySystemType = ShowroomTemplateId | typeof HOMEPAGE_INQUIRY_TYPE;

export const DEVELOPMENT_INQUIRY_TYPES: readonly {
  id: DevelopmentInquirySystemType;
  label: string;
}[] = [
  { id: HOMEPAGE_INQUIRY_TYPE, label: '홈페이지·랜딩 제작' },
  ...SHOWROOM_TEMPLATES.map(({ id, label }) => ({ id, label })),
];

export const SYSTEM_FEATURE_OPTIONS = [
  '고객관리',
  '계약 관리',
  '결제 상태',
  'ERP·WMS',
  'API 연동',
  '콘텐츠 승인',
  'AI 리포트',
  'Owner 승인',
] as const;

export const HOMEPAGE_FEATURE_OPTIONS = [
  '브랜드·서비스 소개',
  '문의·상담 전환',
  '선택 모션 적용',
  '작업·포트폴리오',
  '콘텐츠·SEO',
] as const;

export function isHomepageInquiry(systemType: DevelopmentInquirySystemType | '') {
  return systemType === HOMEPAGE_INQUIRY_TYPE;
}

export function getDevelopmentInquiryTypeLabel(systemType: DevelopmentInquirySystemType | '') {
  return DEVELOPMENT_INQUIRY_TYPES.find((option) => option.id === systemType)?.label ?? systemType;
}
