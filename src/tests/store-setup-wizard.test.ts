import { beforeEach, describe, expect, it } from 'vitest';

import { buildDiagnosisResult, buildRequestDraftFromDiagnosis, type DiagnosisInput } from '@/shared/lib/onboardingFlow';
import { collectStoreSetupStepErrors } from '@/shared/lib/storeSetupSchema';
import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { createStoreFromSetupRequest, saveSetupRequest } from '@/shared/lib/services/mvpService';
import type { SetupRequestInput } from '@/shared/types/models';

const diagnosisInput: DiagnosisInput = {
  availableData: ['manual_notes', 'no_feedback'],
  currentConcern: 'busy_peak_ops',
  desiredOutcome: 'operations_analysis',
  industryType: 'korean_buffet',
  region: '서울 성수동',
  storeModeSelection: 'survey_first',
};

describe('store setup wizard support', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds a store setup draft from diagnosis recommendations', () => {
    const diagnosisResult = buildDiagnosisResult(diagnosisInput);
    const draft = buildRequestDraftFromDiagnosis(diagnosisInput, diagnosisResult);

    expect(draft.address).toBe('서울 성수동');
    expect(draft.businessType).toBe('한식 뷔페');
    expect(draft.storeMode).toBe(diagnosisResult.recommendedStoreMode);
    expect(draft.dataMode).toBe(diagnosisResult.recommendedDataMode);
    expect(draft.selectedFeatures).toEqual(diagnosisResult.recommendedModules);
    expect(draft.primaryCtaLabel.length).toBeGreaterThan(0);
    expect(draft.mobileCtaLabel.length).toBeGreaterThan(0);
    expect(draft.tagline).toContain('한눈에');
  });

  it('returns validation messages for incomplete wizard steps', () => {
    const basicErrors = collectStoreSetupStepErrors('basic', {
      address: '',
      brandName: '',
      businessType: '',
      email: 'invalid-email',
      openingHours: '',
      ownerName: '',
      phone: 'phone',
      storeName: '',
    });
    const moduleErrors = collectStoreSetupStepErrors('modules', {
      selectedFeatures: ['ai_manager'],
    });

    expect(basicErrors.storeName?.[0]).toContain('스토어명');
    expect(basicErrors.email?.[0]).toContain('이메일');
    expect(basicErrors.phone?.[0]).toContain('연락처');
    expect(moduleErrors.selectedFeatures?.[0]).toContain('3개 이상');
  });

  it('persists store mode and public settings into the created store', async () => {
    const input: SetupRequestInput = {
      address: '서울특별시 성동구 성수이로 77',
      brand_name: 'Aurora House',
      business_name: 'Aurora House',
      business_number: '321-54-98765',
      business_type: '한식 뷔페',
      data_mode: 'survey_manual',
      description: '점심 메뉴와 매장 운영 상황을 쉽게 보여주는 공개 스토어입니다.',
      email: 'owner@aurora.kr',
      mobile_cta_label: '바로 참여',
      opening_hours: '매일 10:30 - 21:30',
      owner_name: '김서준',
      phone: '010-5555-8888',
      preview_target: 'survey',
      primary_cta_label: '설문 참여하기',
      public_status: 'public',
      requested_slug: 'demo-aurora-house',
      selected_features: ['ai_manager', 'surveys', 'customer_management', 'ai_business_report'],
      store_mode: 'survey_first',
      tagline: '오늘 메뉴와 운영 상황을 한 번에 보여주는 뷔페 스토어',
      theme_preset: 'warm',
    };

    const savedRequest = await saveSetupRequest(input, { requestedPlan: 'pro' });
    const created = await createStoreFromSetupRequest(input, {
      paymentId: 'demo_payment_t04',
      paymentMethodStatus: 'ready',
      plan: 'pro',
      requestId: savedRequest.id,
      requestStatus: 'approved',
      reviewerEmail: 'onboarding@mybiz.ai.kr',
      setupEventStatus: 'paid',
      setupStatus: 'setup_paid',
      subscriptionEventStatus: 'paid',
      subscriptionStatus: 'subscription_active',
    });

    const database = getDatabase();
    const createdStore = database.stores.find((store) => store.id === created.store.id);
    const createdLocation = database.store_locations.find((location) => location.store_id === created.store.id);
    const updatedRequest = database.store_requests.find((request) => request.id === savedRequest.id);

    expect(updatedRequest).toMatchObject({
      brand_name: 'Aurora House',
      data_mode: 'survey_manual',
      mobile_cta_label: '바로 참여',
      preview_target: 'survey',
      primary_cta_label: '설문 참여하기',
      public_status: 'public',
      store_mode: 'survey_first',
      theme_preset: 'warm',
    });
    expect(createdLocation).toMatchObject({
      opening_hours: '매일 10:30 - 21:30',
      published: true,
    });
    expect(createdStore).toMatchObject({
      data_mode: 'survey_manual',
      homepage_visible: true,
      mobile_cta_label: '바로 참여',
      preview_target: 'survey',
      primary_cta_label: '설문 참여하기',
      public_status: 'public',
      store_mode: 'survey_first',
      theme_preset: 'warm',
    });
    expect(created.publicUrl).toContain('/demo-aurora-house');
  });
});
