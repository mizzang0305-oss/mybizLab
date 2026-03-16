import { beforeEach, describe, expect, it } from 'vitest';

import { buildDiagnosisResult } from '@/shared/lib/onboardingFlow';
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
      businessType: '브런치',
      region: '서울 성수동',
      customerType: '직장인 점심 고객과 재방문 고객',
      operatingConcerns: '예약은 들어오는데 대기 관리가 어렵고 재방문 고객 관리를 더 잘하고 싶습니다.',
    });

    expect(result.score).toBeGreaterThan(60);
    expect(result.recommendedStrategies).toHaveLength(3);
    expect(result.revenueOpportunities).toHaveLength(3);
    expect(['starter', 'pro', 'business']).toContain(result.recommendedPlan);
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
});
