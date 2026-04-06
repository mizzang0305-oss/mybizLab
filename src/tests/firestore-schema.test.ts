import { describe, expect, it } from 'vitest';

import {
  parseFirestoreAdminUser,
  parseFirestoreDiagnosisSession,
  parseFirestoreInsightReport,
  parseFirestoreStore,
  parseFirestoreStoreSettings,
  parseFirestoreSurveyForm,
} from '@/shared/lib/firebase/firestoreSchema';

describe('firestore schema guards', () => {
  it('normalizes a store document with safe defaults', () => {
    const store = parseFirestoreStore('store_demo', {
      admin_email: 'owner@example.com',
      name: 'Demo Store',
      slug: 'demo-store',
    });

    expect(store.id).toBe('store_demo');
    expect(store.subscription_plan).toBe('free');
    expect(store.brand_config.email).toBe('');
  });

  it('validates store settings, survey forms, reports, and admin users with zod', () => {
    const settings = parseFirestoreStoreSettings('settings_demo', {
      store_id: 'store_demo',
      store_mode: 'survey_first',
      data_mode: 'survey_manual',
      enabled_modules: ['surveys', 'ai_reports'],
      updated_at: '2026-03-22T00:00:00.000Z',
    });
    const survey = parseFirestoreSurveyForm('survey_demo', {
      store_id: 'store_demo',
      title: 'Owner survey',
      questions: [{ id: 'q1', label: 'How was it?', type: 'rating' }],
      created_at: '2026-03-22T00:00:00.000Z',
    });
    const report = parseFirestoreInsightReport('report_demo', {
      store_id: 'store_demo',
      report_type: 'weekly',
      title: 'Weekly summary',
      summary: 'Good trend',
      metrics: { score: 91 },
      generated_at: '2026-03-22T00:00:00.000Z',
      source: 'fallback',
    });
    const adminUser = parseFirestoreAdminUser('admin_demo', {
      email: 'owner@example.com',
      role: 'store_owner',
      created_at: '2026-03-22T00:00:00.000Z',
    });
    const diagnosisSession = parseFirestoreDiagnosisSession('diagnosis_demo', {
      analysis_source: 'fallback',
      available_data: ['manual_notes'],
      completed: true,
      created_at: '2026-03-22T00:00:00.000Z',
      current_concern: 'unknown_customer_reaction',
      desired_outcome: 'customer_sentiment',
      industry_type: 'cafe',
      recommended_data_mode: 'survey_manual',
      recommended_modules: ['surveys', 'customer_management', 'ai_business_report'],
      recommended_questions: ['Q1', 'Q2', 'Q3', 'Q4'],
      recommended_store_mode: 'survey_first',
      region: '서울 성수동',
      store_mode_selection: 'not_sure',
      updated_at: '2026-03-22T00:00:00.000Z',
    });

    expect(settings.enabled_modules).toContain('surveys');
    expect(survey.questions).toHaveLength(1);
    expect(report.metrics.score).toBe(91);
    expect(adminUser.role).toBe('store_owner');
    expect(diagnosisSession.recommended_store_mode).toBe('survey_first');
  });
});
