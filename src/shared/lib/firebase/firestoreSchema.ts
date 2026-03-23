import { z } from 'zod';

import { diagnosisSessionDocumentSchema } from '@/shared/lib/diagnosisSchema';
import { surveyFormSchema, surveyQuestionSchema } from '@/shared/lib/surveySchema';
import { normalizeStoreRecord } from '@/shared/lib/storeData';
import type { AdminUser, AIReport, DiagnosisSession, Store, Survey } from '@/shared/types/models';

const storeBrandConfigSchema = z.object({
  owner_name: z.string().default(''),
  business_number: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  address: z.string().default(''),
  business_type: z.string().default(''),
});

export const FIRESTORE_COLLECTIONS = {
  adminUsers: 'admin_users',
  diagnosisSessions: 'diagnosis_sessions',
  insightReports: 'ai_reports',
  storeMembers: 'store_members',
  storeSettings: 'store_settings',
  stores: 'stores',
  surveyForms: 'surveys',
} as const;

export const firestoreStoreSchema = z
  .object({
    id: z.string().min(1),
    store_id: z.string().optional(),
    name: z.string().min(1),
    slug: z.string().min(1),
    brand_config: storeBrandConfigSchema.default({
      owner_name: '',
      business_number: '',
      phone: '',
      email: '',
      address: '',
      business_type: '',
    }),
    brand_color: z.string().default('#ec5b13'),
    tagline: z.string().default('Demo store'),
    description: z.string().default('Demo-ready store record'),
    public_status: z.enum(['public', 'private']).default('public'),
    subscription_plan: z.enum(['starter', 'pro', 'business', 'enterprise']).default('starter'),
    admin_email: z.string().default(''),
    created_at: z.string().default(''),
    updated_at: z.string().default(''),
    homepage_visible: z.boolean().optional(),
    consultation_enabled: z.boolean().optional(),
    inquiry_enabled: z.boolean().optional(),
    reservation_enabled: z.boolean().optional(),
    order_entry_enabled: z.boolean().optional(),
    timezone: z.string().optional(),
    trial_ends_at: z.string().optional(),
    logo_url: z.string().optional(),
  })
  .passthrough();

export const firestoreStoreSettingsSchema = z
  .object({
    id: z.string().min(1),
    store_id: z.string().min(1),
    store_mode: z.enum(['order_first', 'survey_first', 'hybrid', 'brand_inquiry_first']),
    data_mode: z.enum(['order_only', 'survey_only', 'manual_only', 'order_survey', 'survey_manual', 'order_survey_manual']),
    enabled_modules: z.array(z.string().min(1)).default([]),
    mobile_cta_label: z.string().default('지금 참여하기'),
    updated_at: z.string().min(1),
  })
  .passthrough();

export const firestoreSurveyFormSchema = z
  .object({
    id: z.string().min(1),
    store_id: z.string().min(1),
    title: surveyFormSchema.shape.title,
    description: surveyFormSchema.shape.description.default(''),
    questions: z.array(surveyQuestionSchema).default([]),
    is_active: surveyFormSchema.shape.is_active,
    created_at: z.string().min(1),
    updated_at: z.string().default(''),
  })
  .passthrough();

export const firestoreInsightReportSchema = z
  .object({
    id: z.string().min(1),
    store_id: z.string().min(1),
    report_type: z.enum(['daily', 'weekly']),
    title: z.string().min(1),
    summary: z.string().min(1),
    metrics: z.record(z.string(), z.union([z.string(), z.number()])),
    generated_at: z.string().min(1),
    source: z.enum(['gemini', 'fallback']),
  })
  .passthrough();

export const firestoreAdminUserSchema = z
  .object({
    id: z.string().min(1),
    profile_id: z.string().optional(),
    name: z.string().default('운영 관리자'),
    email: z.string().email(),
    role: z.enum(['platform_owner', 'platform_admin', 'store_owner', 'store_manager']),
    linked_store_ids: z.array(z.string().min(1)).default([]),
    status: z.enum(['active', 'pending', 'inactive']).default('active'),
    invitation_status: z.enum(['sent', 'scheduled', 'accepted', 'none']).default('accepted'),
    last_sign_in_at: z.string().optional(),
    created_at: z.string().min(1),
  })
  .passthrough();

export function parseFirestoreStore(id: string, value: unknown): Store {
  const parsed = firestoreStoreSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });

  return normalizeStoreRecord({
    ...parsed,
    store_id: parsed.store_id || parsed.id,
  });
}

export function parseFirestoreStoreSettings(id: string, value: unknown) {
  return firestoreStoreSettingsSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });
}

export function parseFirestoreSurveyForm(id: string, value: unknown): Survey {
  return firestoreSurveyFormSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });
}

export function parseFirestoreInsightReport(id: string, value: unknown): AIReport {
  return firestoreInsightReportSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });
}

export function parseFirestoreAdminUser(id: string, value: unknown): AdminUser {
  return firestoreAdminUserSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });
}

export function parseFirestoreDiagnosisSession(id: string, value: unknown): DiagnosisSession {
  return diagnosisSessionDocumentSchema.parse({
    ...(value && typeof value === 'object' ? value : {}),
    id,
  });
}
