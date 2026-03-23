import { z } from 'zod';

import {
  DIAGNOSIS_AVAILABLE_DATA_OPTIONS,
  DIAGNOSIS_CONCERN_OPTIONS,
  DIAGNOSIS_DESIRED_OUTCOME_OPTIONS,
  DIAGNOSIS_INDUSTRY_OPTIONS,
  DIAGNOSIS_STORE_MODE_OPTIONS,
} from '@/shared/lib/diagnosisBlueprint';
import { ALL_FEATURES } from '@/shared/types/models';

function enumValues<const T extends readonly { value: string }[]>(options: T) {
  return options.map((option) => option.value) as [T[number]['value'], ...T[number]['value'][]];
}

const diagnosisIndustryValues = enumValues(DIAGNOSIS_INDUSTRY_OPTIONS);
const diagnosisStoreModeValues = enumValues(DIAGNOSIS_STORE_MODE_OPTIONS);
const diagnosisConcernValues = enumValues(DIAGNOSIS_CONCERN_OPTIONS);
const diagnosisAvailableDataValues = enumValues(DIAGNOSIS_AVAILABLE_DATA_OPTIONS);
const diagnosisDesiredOutcomeValues = enumValues(DIAGNOSIS_DESIRED_OUTCOME_OPTIONS);

export const diagnosisInputSchema = z.object({
  availableData: z.array(z.enum(diagnosisAvailableDataValues)).min(1, '보유 데이터는 최소 1개 이상 선택해야 합니다.'),
  currentConcern: z.enum(diagnosisConcernValues),
  desiredOutcome: z.enum(diagnosisDesiredOutcomeValues),
  industryType: z.enum(diagnosisIndustryValues),
  region: z.string().trim().min(2, '지역을 입력해 주세요.').max(80, '지역은 80자 이하로 입력해 주세요.'),
  storeModeSelection: z.enum(diagnosisStoreModeValues),
});

export const diagnosisRecommendedStoreModeSchema = z.enum(diagnosisStoreModeValues.filter((value) => value !== 'not_sure') as [
  'order_first',
  'survey_first',
  'hybrid',
  'brand_inquiry_first',
]);

export const diagnosisDataModeSchema = z.enum([
  'order_only',
  'survey_only',
  'manual_only',
  'order_survey',
  'survey_manual',
  'order_survey_manual',
]);

export const diagnosisResultSchema = z.object({
  analysisBasis: z.string().trim().min(1),
  analysisSource: z.enum(['gpt', 'fallback']),
  coreBottlenecks: z.array(z.string().trim().min(1)).min(3).max(3),
  expansionFeatures: z.array(z.string().trim().min(1)).min(3).max(3),
  immediateActions: z.array(z.string().trim().min(1)).min(3).max(3),
  limitationsNote: z.string().trim().min(1),
  recommendedDataMode: diagnosisDataModeSchema,
  recommendedModules: z.array(z.enum(ALL_FEATURES)).min(3).max(6),
  recommendedPlan: z.enum(['starter', 'pro', 'business']),
  recommendedQuestions: z.array(z.string().trim().min(1)).min(4).max(4),
  recommendedStoreMode: diagnosisRecommendedStoreModeSchema,
  recommendedStrategies: z.array(z.string().trim().min(1)).min(3).max(3),
  reportSummary: z.string().trim().min(1),
  revenueOpportunities: z.array(z.string().trim().min(1)).min(3).max(3),
  score: z.number().int().min(58).max(94),
  suggestedFeatures: z.array(z.enum(ALL_FEATURES)).min(3).max(6),
  summary: z.string().trim().min(1),
});

export const diagnosisModelDraftSchema = diagnosisResultSchema
  .pick({
    coreBottlenecks: true,
    expansionFeatures: true,
    immediateActions: true,
    recommendedDataMode: true,
    recommendedModules: true,
    recommendedPlan: true,
    recommendedQuestions: true,
    recommendedStoreMode: true,
    recommendedStrategies: true,
    reportSummary: true,
    revenueOpportunities: true,
    score: true,
    suggestedFeatures: true,
    summary: true,
  })
  .partial();

export const diagnosisSessionDocumentSchema = z.object({
  analysis_source: z.enum(['gpt', 'fallback']),
  available_data: z.array(z.enum(diagnosisAvailableDataValues)).min(1),
  completed: z.boolean(),
  created_at: z.string().trim().min(1),
  current_concern: z.enum(diagnosisConcernValues),
  desired_outcome: z.enum(diagnosisDesiredOutcomeValues),
  id: z.string().trim().min(1),
  industry_type: z.enum(diagnosisIndustryValues),
  recommended_data_mode: diagnosisDataModeSchema,
  recommended_modules: z.array(z.enum(ALL_FEATURES)).min(3).max(6),
  recommended_questions: z.array(z.string().trim().min(1)).min(4).max(4),
  recommended_store_mode: diagnosisRecommendedStoreModeSchema,
  region: z.string().trim().min(2),
  store_mode_selection: z.enum(diagnosisStoreModeValues),
  updated_at: z.string().trim().min(1),
  visitor_key: z.string().trim().min(1).optional(),
});

export type DiagnosisInputDocument = z.infer<typeof diagnosisInputSchema>;
export type DiagnosisResultDocument = z.infer<typeof diagnosisResultSchema>;
export type DiagnosisSessionDocument = z.infer<typeof diagnosisSessionDocumentSchema>;
