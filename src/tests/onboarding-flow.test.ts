import { beforeEach, describe, expect, it } from 'vitest';

import { applyOnboardingSetupRequestSaved, buildDiagnosisResult, createInitialOnboardingFlowState } from '@/shared/lib/onboardingFlow';
import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { createStoreFromSetupRequest, saveSetupRequest } from '@/shared/lib/services/mvpService';
import type { SetupRequestInput } from '@/shared/types/models';

const requestInput: SetupRequestInput = {
  business_name: 'Seongsu Brunch House',
  owner_name: '홍길동',
  business_number: '123-45-67890',
  phone: '010-1234-5678',
  email: 'owner@brunch.kr',
  address: '서울 성수동',
  business_type: '브런치',
  requested_slug: 'seongsu-brunch-house',
  selected_features: ['ai_manager', 'customer_management', 'reservation_management', 'sales_analysis', 'order_management', 'table_order'],
};

describe('onboarding flow helpers', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds a diagnosis result with score, strategies, and a recommended plan', () => {
    const result = buildDiagnosisResult({
      availableData: ['order_data', 'manual_notes'],
      currentConcern: 'service_quality',
      desiredOutcome: 'service_improvement',
      industryType: 'restaurant',
      region: '서울 성수동',
      storeModeSelection: 'hybrid',
    });

    expect(result.score).toBeGreaterThan(60);
    expect(result.coreBottlenecks).toHaveLength(3);
    expect(result.recommendedStrategies).toHaveLength(3);
    expect(result.revenueOpportunities).toHaveLength(3);
    expect(result.immediateActions).toHaveLength(3);
    expect(result.expansionFeatures).toHaveLength(3);
    expect(result.recommendedQuestions).toHaveLength(4);
    expect(result.recommendedModules.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendedStoreMode).toBe('hybrid');
    expect(result.recommendedDataMode).toBe('order_survey_manual');
    expect(result.reportSummary).toContain('서울 성수동');
    expect(result.analysisSource).toBe('fallback');
    expect(result.limitationsNote).toContain('실시간 POS');
    expect(['free', 'pro', 'vip']).toContain(result.recommendedPlan);
  });

  it('moves the onboarding flow to payment after a save succeeds', () => {
    const initialState = {
      ...createInitialOnboardingFlowState(),
      requestWizardStep: 'summary' as const,
      selectedPlan: 'pro' as const,
      step: 'request' as const,
    };

    const nextState = applyOnboardingSetupRequestSaved(initialState, '431ba667-6fd5-4e62-b537-ca2e99ca825c');

    expect(nextState.requestId).toBe('431ba667-6fd5-4e62-b537-ca2e99ca825c');
    expect(nextState.step).toBe('payment');
    expect(nextState.requestWizardStep).toBe('summary');
    expect(nextState.selectedPlan).toBe('pro');
  });

  it('stores the request and activates the store with paid billing state', async () => {
    const savedRequest = await saveSetupRequest(requestInput, { requestedPlan: 'pro' });
    const created = await createStoreFromSetupRequest(requestInput, {
      requestId: savedRequest.id,
      plan: 'pro',
      paymentId: 'demo_12345',
      paymentMethodStatus: 'ready',
      requestStatus: 'approved',
      reviewerEmail: 'onboarding@mybiz.ai.kr',
      reviewNotes: 'AI 진단 후 결제가 완료되어 자동 승인되었습니다.',
      setupEventStatus: 'paid',
      setupStatus: 'setup_paid',
      subscriptionEventStatus: 'paid',
      subscriptionStatus: 'subscription_active',
    });

    const database = getDatabase();
    const updatedRequest = database.store_requests.find((request) => request.id === savedRequest.id);
    const billingRecord = database.billing_records.find((record) => record.store_id === created.store.id);

    expect(updatedRequest).toMatchObject({
      id: savedRequest.id,
      linked_store_id: created.store.id,
      requested_plan: 'pro',
      status: 'approved',
    });

    expect(billingRecord).toMatchObject({
      plan: 'pro',
      setup_status: 'setup_paid',
      subscription_status: 'subscription_active',
      payment_method_status: 'ready',
    });
    expect(billingRecord?.events.some((event) => event.event_type === 'setup_fee' && event.status === 'paid')).toBe(true);
    expect(billingRecord?.events.some((event) => event.event_type === 'subscription_charge' && event.status === 'paid')).toBe(true);
  });

  it('activates the free plan without paid billing events and provisions a canonical public page', async () => {
    const savedRequest = await saveSetupRequest(requestInput, { requestedPlan: 'free' });
    const created = await createStoreFromSetupRequest(requestInput, {
      requestId: savedRequest.id,
      plan: 'free',
      paymentId: 'free_12345',
      paymentMethodStatus: 'ready',
      requestStatus: 'approved',
      reviewerEmail: 'onboarding@mybiz.ai.kr',
      setupStatus: 'setup_paid',
      subscriptionStatus: 'subscription_active',
    });

    const database = getDatabase();
    const billingRecord = database.billing_records.find((record) => record.store_id === created.store.id);
    const storeSubscription = database.store_subscriptions.find((subscription) => subscription.store_id === created.store.id);
    const publicPage = database.store_public_pages.find((page) => page.store_id === created.store.id);

    expect(billingRecord?.plan).toBe('free');
    expect(billingRecord?.events.some((event) => event.status === 'paid' && event.amount > 0)).toBe(false);
    expect(storeSubscription).toMatchObject({
      plan: 'free',
      status: 'active',
    });
    expect(publicPage?.slug).toBe(created.store.slug);
  });
});
