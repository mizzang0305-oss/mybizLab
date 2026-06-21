import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildVipCampaignPreparationPreview,
  buildVipDeliveryApprovalGatePlan,
  buildVipCustomerReadonlyView,
  buildVipCustomerReadonlyReportSample,
  VIP_CUSTOMER_CRITERIA_DOCUMENTATION,
  maskVipCustomerContact,
  maskVipCustomerName,
} from '@/shared/lib/services/vipCustomerReadonlyViewService';
import type { Customer, CustomerPreference, CustomerTimelineEvent, Order } from '@/shared/types/models';

const baseCustomer = {
  created_at: '2026-06-01T00:00:00.000Z',
  email: 'alpha@example.test',
  id: 'customer-alpha',
  is_regular: false,
  last_visit_at: '2026-06-10T00:00:00.000Z',
  marketing_opt_in: false,
  name: 'Alpha Guest',
  phone: '0000000000',
  store_id: 'store-a',
  updated_at: '2026-06-10T00:00:00.000Z',
  visit_count: 1,
} satisfies Customer;

function customer(overrides: Partial<Customer> & Record<string, unknown> = {}): Customer {
  return {
    ...baseCustomer,
    ...overrides,
  } as Customer;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    channel: 'table',
    id: 'order-a',
    payment_status: 'paid',
    placed_at: '2026-06-12T00:00:00.000Z',
    status: 'completed',
    store_id: 'store-a',
    total_amount: 120000,
    ...overrides,
  };
}

describe('VIP customer readonly view service', () => {
  it('filters only derived VIP customers for the requested store and never uses subscription VIP as customer VIP', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [
        customer({ id: 'vip-by-orders', visit_count: 1 }),
        customer({ id: 'not-vip', name: 'Beta Guest', phone: '0000000001', visit_count: 1 }),
        customer({ id: 'other-store-vip', store_id: 'store-b', visit_count: 9 }),
      ],
      orders: [
        order({ customer_id: 'vip-by-orders', id: 'order-1', total_amount: 80000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-2', total_amount: 90000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-3', total_amount: 100000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-4', total_amount: 110000 }),
        order({ customer_id: 'vip-by-orders', id: 'order-5', total_amount: 120000 }),
        order({ customer_id: 'other-store-vip', id: 'order-other', store_id: 'store-b', total_amount: 500000 }),
      ],
      storeId: 'store-a',
      storeSubscriptionPlan: 'vip',
    });

    expect(result.vipCustomers.map((item) => item.customerId)).toEqual(['vip-by-orders']);
    expect(result.vipCustomers[0]?.vipReasons).toContain('order_count_threshold');
    expect(result.vipCustomers[0]?.vipReasons).toContain('lifetime_value_threshold');
    expect(result.summary.storeSubscriptionPlan).toBe('vip');
    expect(result.summary.subscriptionPlanIsCustomerVipSource).toBe(false);
  });

  it('masks names and contacts while returning aggregate read-only profile evidence', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [customer({ email: 'alpha@example.test', id: 'vip-alpha', name: 'Alpha Guest', visit_count: 6 })],
      orders: [order({ customer_id: 'vip-alpha', total_amount: 360000 })],
      preferences: [
        {
          created_at: '2026-06-01T00:00:00.000Z',
          customer_id: 'vip-alpha',
          id: 'preference-alpha',
          is_primary: true,
          marketing_opt_in: false,
          preference_tags: ['window seat', 'decaf'],
          store_id: 'store-a',
          updated_at: '2026-06-10T00:00:00.000Z',
        } as unknown as CustomerPreference,
      ],
      timelineEvents: [
        {
          created_at: '2026-06-12T00:00:00.000Z',
          customer_id: 'vip-alpha',
          event_type: 'order_linked',
          id: 'timeline-alpha',
          metadata: {},
          occurred_at: '2026-06-12T00:00:00.000Z',
          source: 'public_order',
          store_id: 'store-a',
          summary: 'order linked',
        } satisfies CustomerTimelineEvent,
      ],
      storeId: 'store-a',
    });

    const vip = result.vipCustomers[0];

    expect(maskVipCustomerName('Alpha Guest')).toBe('A**********');
    expect(maskVipCustomerContact('0000000000', 'phone')).toBe('000-***-0000');
    expect(maskVipCustomerContact('alpha@example.test', 'email')).toBe('a***@example.test');
    expect(vip?.maskedDisplayName).toBe('A**********');
    expect(vip?.maskedContact).toBe('000-***-0000');
    expect(vip?.profileSummaryText).toContain('orders=1');
    expect(vip?.preferenceSummary).toContain('window seat');
    expect(vip?.readOnly).toBe(true);
    expect(vip?.allowedActions).toEqual([]);
  });

  it('returns an empty read-only state when no customer reaches VIP rules', () => {
    const result = buildVipCustomerReadonlyView({
      customers: [customer({ id: 'not-vip', visit_count: 1 })],
      orders: [],
      storeId: 'store-a',
    });

    expect(result.vipCustomers).toEqual([]);
    expect(result.emptyState.title).toContain('VIP');
    expect(result.readOnlyNotice).toContain('read-only');
  });

  it('wires a read-only VIP customer panel into the customer dashboard page without write controls', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(pageSource).toContain('buildVipCustomerReadonlyView');
    expect(pageSource).toContain('VIP Customer Memory');
    expect(pageSource).toContain('read-only');
    expect(pageSource).not.toMatch(/vipCustomerMutation|setVip|updateVip|deleteVip|mergeVip|createVip/i);
  });

  it('builds masked read-only report sample sections without using subscription VIP as a customer signal', () => {
    const report = buildVipCustomerReadonlyReportSample({
      customers: [
        customer({
          email: 'revisit@example.test',
          id: 'vip-revisit',
          last_visit_at: '2026-06-18T00:00:00.000Z',
          name: 'Revisit Guest',
          phone: '0000000002',
          visit_count: 8,
        }),
        customer({
          email: 'upsell@example.test',
          id: 'vip-upsell',
          last_visit_at: '2026-06-12T00:00:00.000Z',
          name: 'Upsell Guest',
          phone: '0000000003',
          visit_count: 2,
        }),
        customer({
          email: 'dormant@example.test',
          id: 'vip-dormant',
          last_visit_at: '2026-04-01T00:00:00.000Z',
          name: 'Dormant Guest',
          phone: '0000000004',
          visit_count: 7,
        }),
        customer({
          id: 'subscription-only',
          last_visit_at: '2026-06-20T00:00:00.000Z',
          name: 'Subscription Only',
          phone: '0000000005',
          visit_count: 1,
        }),
        customer({
          id: 'other-store-vip',
          name: 'Other Store Guest',
          phone: '0000000006',
          store_id: 'store-b',
          visit_count: 10,
        }),
      ],
      orders: [
        order({ customer_id: 'vip-revisit', id: 'revisit-order', total_amount: 320000 }),
        order({ customer_id: 'vip-upsell', id: 'upsell-order-1', total_amount: 180000 }),
        order({ customer_id: 'vip-upsell', id: 'upsell-order-2', total_amount: 180000 }),
        order({
          customer_id: 'vip-dormant',
          id: 'dormant-order',
          placed_at: '2026-03-15T00:00:00.000Z',
          total_amount: 360000,
        }),
        order({ customer_id: 'other-store-vip', id: 'other-store-order', store_id: 'store-b', total_amount: 500000 }),
      ],
      referenceDate: '2026-06-21T00:00:00.000Z',
      storeId: 'store-a',
      storeSubscriptionPlan: 'vip',
    });

    expect(report.summary.subscriptionPlanIsCustomerVipSource).toBe(false);
    expect(report.sections.map((section) => section.title)).toEqual([
      '이번 주 다시 부를 고객 후보',
      '객단가 상승 가능 고객 후보',
      '휴면 위험 VIP 고객 후보',
    ]);
    expect(report.sections.flatMap((section) => section.candidates).map((candidate) => candidate.customerId)).not.toContain(
      'subscription-only',
    );
    expect(report.sections.flatMap((section) => section.candidates).map((candidate) => candidate.customerId)).not.toContain(
      'other-store-vip',
    );
    expect(report.allowedActions).toEqual([]);
    expect(report.readOnlyNotice).toContain('확인 전용');
    expect(JSON.stringify(report)).not.toMatch(/Revisit Guest|0000000002|revisit@example\.test/);
    expect(JSON.stringify(report)).not.toMatch(/send|update|delete|merge|execute/i);
  });

  it('keeps VIP criteria documentation free of real PII and write-capable campaign language', () => {
    const docs = [
      readFileSync(join(process.cwd(), 'docs/vip-customer-readonly-view.md'), 'utf8'),
      readFileSync(join(process.cwd(), 'docs/vip-customer-criteria.md'), 'utf8'),
      readFileSync(join(process.cwd(), 'docs/vip-customer-report-sample.md'), 'utf8'),
      readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-approval-gate.md'), 'utf8'),
      JSON.stringify(VIP_CUSTOMER_CRITERIA_DOCUMENTATION),
    ].join('\n');

    expect(docs).toContain('customer VIP');
    expect(docs).toContain('subscription VIP');
    expect(docs).toContain('store_id');
    expect(docs).toContain('확인 전용 리포트');
    const forbiddenPhrases = [
      ['자동 발', '송 완료'],
      ['고객 등급', ' 자동 변경'],
      ['실제 고객', ' 연락처'],
      ['운영 DB', ' 반영'],
      ['캠페인', ' 실행'],
    ].map(([left, right]) => `${left}${right}`);

    for (const phrase of forbiddenPhrases) {
      expect(docs).not.toContain(phrase);
    }
    expect(docs).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(docs).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds preview-only VIP campaign preparation sections without delivery or customer write actions', () => {
    const preview = buildVipCampaignPreparationPreview({
      customers: [
        customer({
          id: 'vip-return',
          last_visit_at: '2026-06-19T00:00:00.000Z',
          name: 'Return Guest',
          phone: '0000000007',
          visit_count: 8,
        }),
        customer({
          id: 'vip-lift',
          last_visit_at: '2026-06-13T00:00:00.000Z',
          name: 'Lift Guest',
          phone: '0000000008',
          visit_count: 2,
        }),
        customer({
          id: 'vip-risk',
          last_visit_at: '2026-03-20T00:00:00.000Z',
          name: 'Risk Guest',
          phone: '0000000009',
          visit_count: 7,
        }),
        customer({
          id: 'subscription-plan-only',
          name: 'Plan Only Guest',
          phone: '0000000010',
          visit_count: 1,
        }),
        customer({
          id: 'other-store-campaign',
          name: 'Other Store Campaign',
          phone: '0000000011',
          store_id: 'store-b',
          visit_count: 9,
        }),
      ],
      orders: [
        order({ customer_id: 'vip-return', id: 'return-order', total_amount: 320000 }),
        order({ customer_id: 'vip-lift', id: 'lift-order-1', total_amount: 190000 }),
        order({ customer_id: 'vip-lift', id: 'lift-order-2', total_amount: 190000 }),
        order({
          customer_id: 'vip-risk',
          id: 'dormant-order-2',
          placed_at: '2026-03-22T00:00:00.000Z',
          total_amount: 360000,
        }),
        order({
          customer_id: 'other-store-campaign',
          id: 'other-campaign-order',
          store_id: 'store-b',
          total_amount: 500000,
        }),
      ],
      referenceDate: '2026-06-21T00:00:00.000Z',
      storeId: 'store-a',
      storeSubscriptionPlan: 'vip',
    });

    expect(preview.previewOnly).toBe(true);
    expect(preview.deliveryEnabled).toBe(false);
    expect(preview.approvalRequired).toBe(true);
    expect(preview.blockedActions).toEqual([
      'send_sms',
      'send_kakao',
      'send_email',
      'update_customer',
      'execute_campaign',
    ]);
    expect(preview.sections.map((section) => section.section)).toEqual([
      'return_this_week',
      'raise_average_order_value',
      'dormancy_risk',
    ]);
    expect(preview.sections.every((section) => section.previewOnly && !section.deliveryEnabled)).toBe(true);
    expect(preview.sections.every((section) => section.suggestedMessageDraft.length > 0)).toBe(true);
    expect(preview.sections.flatMap((section) => section.maskedCandidates).map((candidate) => candidate.customerId)).not.toContain(
      'subscription-plan-only',
    );
    expect(preview.sections.flatMap((section) => section.maskedCandidates).map((candidate) => candidate.customerId)).not.toContain(
      'other-store-campaign',
    );
    expect(JSON.stringify(preview)).not.toMatch(/Return Guest|0000000007/);
    const blockedFunctionNames = [
      ['send', 'Sms'],
      ['send', 'Kakao'],
      ['send', 'Email'],
      ['execute', 'Campaign'],
      ['update', 'Customer'],
    ].map(([left, right]) => `${left}${right}`);

    for (const blockedFunctionName of blockedFunctionNames) {
      expect(JSON.stringify(preview)).not.toContain(blockedFunctionName);
    }
  });

  it('documents and wires VIP campaign preparation as a read-only preview without send or execution buttons', () => {
    const campaignDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-campaign-prep-preview.md'), 'utf8');
    const deliveryGateDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-approval-gate.md'), 'utf8');
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(campaignDoc).toContain('delivery approval gate');
    expect(campaignDoc).toContain('docs/vip-customer-delivery-approval-gate.md');
    expect(deliveryGateDoc).toContain('owner approval');
    expect(deliveryGateDoc).toContain('marketing consent');
    expect(campaignDoc).toContain('read-only');
    expect(campaignDoc).toContain('preview-only');
    expect(campaignDoc).toContain('store_id');
    expect(pageSource).toContain('buildVipCampaignPreparationPreview');
    expect(pageSource).toContain('buildVipDeliveryApprovalGatePlan');
    expect(pageSource).toContain('캠페인 준비 미리보기');
    expect(pageSource).toContain('발송 전 승인 필요');
    expect(pageSource).toContain('SMS/Kakao/Email delivery is not executed here');
    expect(pageSource).toContain('별도 승인 게이트 필요');
    expect(pageSource).toContain('SMS/Kakao/Email 연동은 future approval scope');
    for (const blockedUiText of ['발송하기', '캠페인 실행', '자동 발송', '고객 등급 변경', '운영 DB 반영 완료']) {
      expect(pageSource).not.toContain(blockedUiText);
    }
  });

  it('builds a pure delivery approval gate plan without enabling delivery or using subscription VIP as a signal', () => {
    const plan = buildVipDeliveryApprovalGatePlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(plan.deliveryExecutionEnabled).toBe(false);
    expect(plan.requiresOwnerApproval).toBe(true);
    expect(plan.requiresMarketingConsent).toBe(true);
    expect(plan.requiresMaskedPreviewReview).toBe(true);
    expect(plan.requiresFinalRecipientCountReview).toBe(true);
    expect(plan.storeTenancyRequired).toBe(true);
    expect(plan.deliveryIntegrationScope).toEqual({
      email: 'future_approval_only',
      kakao: 'future_approval_only',
      sms: 'future_approval_only',
    });
    expect(plan.blockedActions).toEqual([
      'send_sms',
      'send_kakao',
      'send_email',
      'schedule_send',
      'execute_campaign',
    ]);
    expect(JSON.stringify(plan)).not.toMatch(/phone|emailAddress|customerName|subscriptionPlanIsCustomerVipSource/i);
    expect(serviceSource).not.toMatch(/sendSms|sendKakao|sendEmail|scheduleSend|executeCampaign|deliveryProvider|fetch\(|axios/i);
    for (const blockedUiText of ['발송하기', '예약 발송', '캠페인 실행', '카카오 발송', '문자 발송', '이메일 발송', '고객에게 전송 완료']) {
      expect(pageSource).not.toContain(blockedUiText);
    }
  });
});
