import { z } from 'zod';

import { DIAGNOSIS_STORE_MODE_OPTIONS, type DiagnosisDataMode, type DiagnosisRecommendedStoreMode } from '@/shared/lib/diagnosisBlueprint';
import { ALL_FEATURES } from '@/shared/types/models';

export type StoreSetupTheme = 'light' | 'warm' | 'modern';
export type StoreSetupPreviewTarget = 'survey' | 'order' | 'inquiry';
export type StoreSetupWizardStep = 'basic' | 'storeMode' | 'dataMode' | 'modules' | 'public' | 'summary';

export const STORE_SETUP_DATA_MODE_OPTIONS: Array<{
  description: string;
  label: string;
  value: DiagnosisDataMode;
}> = [
  { description: '주문 데이터만으로 메뉴 반응과 주문 흐름을 봅니다.', label: '주문 데이터 중심', value: 'order_only' },
  { description: '설문 응답만으로 만족과 불만 흐름을 봅니다.', label: '설문 데이터 중심', value: 'survey_only' },
  { description: '점주가 직접 남기는 수기 데이터 중심으로 시작합니다.', label: '수기 데이터 중심', value: 'manual_only' },
  { description: '주문 데이터와 설문 응답을 함께 비교합니다.', label: '주문 + 설문', value: 'order_survey' },
  { description: '설문 응답과 수기 운영 기록을 함께 씁니다.', label: '설문 + 수기', value: 'survey_manual' },
  { description: '주문, 설문, 수기 데이터를 모두 엮어 봅니다.', label: '주문 + 설문 + 수기', value: 'order_survey_manual' },
];

export const STORE_SETUP_THEME_OPTIONS: Array<{
  description: string;
  label: string;
  value: StoreSetupTheme;
}> = [
  { description: '밝고 깔끔하게 정보를 먼저 보여주는 기본형입니다.', label: 'Light', value: 'light' },
  { description: '따뜻한 톤으로 식당, 뷔페, 브런치 매장에 잘 맞습니다.', label: 'Warm', value: 'warm' },
  { description: '차분하고 선명한 대비로 카페와 브랜드형 매장에 잘 맞습니다.', label: 'Modern', value: 'modern' },
];

export const STORE_SETUP_PREVIEW_TARGET_OPTIONS: Array<{
  description: string;
  label: string;
  value: StoreSetupPreviewTarget;
}> = [
  { description: '모바일 첫 CTA를 설문 참여로 연결합니다.', label: '설문 유도', value: 'survey' },
  { description: '메뉴 보기나 주문 진입을 먼저 보여줍니다.', label: '주문/메뉴 유도', value: 'order' },
  { description: '문의 남기기와 상담 유입을 먼저 받습니다.', label: '문의 유도', value: 'inquiry' },
];

const storeModeValues = DIAGNOSIS_STORE_MODE_OPTIONS.filter((option) => option.value !== 'not_sure').map((option) => option.value) as [
  DiagnosisRecommendedStoreMode,
  ...DiagnosisRecommendedStoreMode[],
];

const dataModeValues = STORE_SETUP_DATA_MODE_OPTIONS.map((option) => option.value) as [DiagnosisDataMode, ...DiagnosisDataMode[]];

const themeValues = STORE_SETUP_THEME_OPTIONS.map((option) => option.value) as [StoreSetupTheme, ...StoreSetupTheme[]];
const previewTargetValues = STORE_SETUP_PREVIEW_TARGET_OPTIONS.map((option) => option.value) as [
  StoreSetupPreviewTarget,
  ...StoreSetupPreviewTarget[],
];

const textField = (label: string, minLength = 2) =>
  z
    .string()
    .trim()
    .min(minLength, `${label}을(를) 입력해 주세요.`);

const emailField = z.string().trim().email('올바른 이메일 형식을 입력해 주세요.');

const phoneField = z
  .string()
  .trim()
  .min(9, '연락처를 입력해 주세요.')
  .refine((value) => /^[0-9+\-\s()]+$/.test(value), '연락처는 숫자와 하이픈 중심으로 입력해 주세요.');

export const storeSetupBasicInfoSchema = z.object({
  address: textField('주소', 4),
  brandName: textField('브랜드명'),
  businessType: textField('업종'),
  email: emailField,
  openingHours: textField('영업시간', 3),
  ownerName: textField('대표자명'),
  phone: phoneField,
  storeName: textField('스토어명'),
});

export const storeSetupStoreModeSchema = z.object({
  storeMode: z.enum(storeModeValues, { message: '운영 모드를 선택해 주세요.' }),
});

export const storeSetupDataModeSchema = z.object({
  dataMode: z.enum(dataModeValues, { message: '데이터 모드를 선택해 주세요.' }),
});

export const storeSetupModulesSchema = z.object({
  selectedFeatures: z
    .array(z.enum(ALL_FEATURES))
    .min(3, '앱은 3개 이상 선택해 주세요.')
    .max(8, '앱은 8개 이하로 선택해 주세요.'),
});

export const storeSetupPublicSettingsSchema = z.object({
  description: textField('소개 문구', 8),
  mobileCtaLabel: textField('모바일 CTA 문구'),
  previewTarget: z.enum(previewTargetValues, { message: '모바일 첫 CTA 연결 방식을 선택해 주세요.' }),
  primaryCtaLabel: textField('기본 CTA 문구'),
  publicStatus: z.enum(['public', 'private']),
  tagline: textField('대표 문구', 4),
  themePreset: z.enum(themeValues, { message: '공개 화면 테마를 선택해 주세요.' }),
});

export const storeSetupDraftSchema = storeSetupBasicInfoSchema
  .merge(storeSetupStoreModeSchema)
  .merge(storeSetupDataModeSchema)
  .merge(storeSetupModulesSchema)
  .merge(storeSetupPublicSettingsSchema)
  .extend({
    requestedSlug: z.string().trim().optional().default(''),
  });

const stepSchemaMap: Record<Exclude<StoreSetupWizardStep, 'summary'>, z.ZodTypeAny> = {
  basic: storeSetupBasicInfoSchema,
  dataMode: storeSetupDataModeSchema,
  modules: storeSetupModulesSchema,
  public: storeSetupPublicSettingsSchema,
  storeMode: storeSetupStoreModeSchema,
};

export function collectStoreSetupStepErrors(
  step: Exclude<StoreSetupWizardStep, 'summary'>,
  input: unknown,
): Record<string, string[] | undefined> {
  const parsed = stepSchemaMap[step].safeParse(input);

  if (parsed.success) {
    return {};
  }

  return parsed.error.flatten().fieldErrors;
}
