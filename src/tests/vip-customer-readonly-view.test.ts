import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCustomerMarketingConsentModelPlan,
  buildVipCampaignPreparationPreview,
  buildVipDeliveryExecutionContract,
  buildVipDeliveryProviderSelectionPlan,
  buildVipDeliveryReadinessChecklist,
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
      readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'), 'utf8'),
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
    expect(serviceSource).not.toMatch(/sendSms|sendKakao|sendEmail|scheduleSend|executeCampaign|providerClient|fetch\(|axios/i);
    for (const blockedUiText of ['발송하기', '예약 발송', '캠페인 실행', '카카오 발송', '문자 발송', '이메일 발송', '고객에게 전송 완료']) {
      expect(pageSource).not.toContain(blockedUiText);
    }
  });

  it('builds a pure delivery execution contract without provider integration or execution paths', () => {
    const contract = buildVipDeliveryExecutionContract();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');
    const executionDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'), 'utf8');

    expect(contract.deliveryExecutionEnabled).toBe(false);
    expect(contract.providerIntegrationEnabled).toBe(false);
    expect(contract.allowedChannels).toEqual([]);
    expect(contract.futureChannels).toEqual(['sms', 'kakao', 'email']);
    expect(contract.requiresOwnerApproval).toBe(true);
    expect(contract.requiresMarketingConsent).toBe(true);
    expect(contract.requiresMaskedPreviewReview).toBe(true);
    expect(contract.requiresFinalRecipientCountReview).toBe(true);
    expect(contract.requiresMessageBodyReview).toBe(true);
    expect(contract.requiresDuplicateSendPrevention).toBe(true);
    expect(contract.requiresCostApproval).toBe(true);
    expect(contract.requiresAuditLog).toBe(true);
    expect(contract.requiresCancellationPolicy).toBe(true);
    expect(contract.requiresFailureHandling).toBe(true);
    expect(contract.requiresRollbackPolicy).toBe(true);
    expect(contract.blockedActions).toEqual([
      'send_sms',
      'send_kakao',
      'send_email',
      'schedule_send',
      'execute_campaign',
      'resolve_raw_recipient',
      'write_delivery_log',
      'create_campaign_execution',
    ]);
    expect(JSON.stringify(contract)).not.toMatch(/phone|emailAddress|customerName|subscriptionPlanIsCustomerVipSource/i);
    expect(serviceSource).not.toMatch(/sendSms|sendKakao|sendEmail|scheduleSend|executeCampaign|resolveRawRecipient|writeDeliveryLog|createCampaignExecution|providerClient|fetch\(|axios/i);
    expect(pageSource).toContain('buildVipDeliveryExecutionContract');
    expect(pageSource).toContain('Delivery execution contract required');
    expect(pageSource).toContain('providerIntegrationEnabled');
    for (const blockedUiText of ['발송하기', '예약 발송', '캠페인 실행', '문자 발송', '카카오 발송', '이메일 발송', '전송 완료']) {
      expect(pageSource).not.toContain(blockedUiText);
    }
    for (const requiredDocPhrase of [
      'ownerApprovalRequired',
      'marketingConsentRequired',
      'duplicateSendPreventionRequired',
      'auditLogRequired',
      'failureHandlingRequired',
      'providerIntegrationEnabled: false',
    ]) {
      expect(executionDoc).toContain(requiredDocPhrase);
    }
    expect(executionDoc).not.toMatch(/[A-Z0-9._%+-]+@gmail\.com|[A-Z0-9._%+-]+@naver\.com/i);
    expect(executionDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a read-only delivery readiness checklist without provider integration or recipient resolution', () => {
    const checklist = buildVipDeliveryReadinessChecklist();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const readinessDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-readiness-checklist.md'), 'utf8');
    const executionDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'), 'utf8');

    expect(checklist).toEqual({
      readinessCheckEnabled: true,
      deliveryExecutionEnabled: false,
      providerIntegrationEnabled: false,
      checklistMode: 'readiness_only',
      requiresOwnerApproval: true,
      requiresMarketingConsent: true,
      requiresRecipientCountReview: true,
      requiresMessageBodyReview: true,
      requiresCostApproval: true,
      requiresDuplicatePrevention: true,
      requiresOptOutExclusion: true,
      requiresFailurePolicy: true,
      requiresCancellationPolicy: true,
      blockedActions: [
        'send_sms',
        'send_kakao',
        'send_email',
        'schedule_send',
        'execute_campaign',
        'resolve_raw_recipient',
        'write_delivery_log',
        'create_campaign_execution',
      ],
    });
    expect(JSON.stringify(checklist)).not.toMatch(/phone|emailAddress|customerName|subscriptionPlanIsCustomerVipSource/i);
    expect(serviceSource).not.toMatch(/sendSms|sendKakao|sendEmail|scheduleSend|executeCampaign|resolveRawRecipient|writeDeliveryLog|createCampaignExecution|providerClient|fetch\(|axios/i);
    for (const requiredDocPhrase of [
      'readiness_only',
      'owner approval checklist',
      'marketing consent checklist',
      'recipient count review checklist',
      'message body review checklist',
      'cost approval checklist',
      'duplicate prevention checklist',
      'opt-out and withdrawal exclusion checklist',
      'failure and cancellation policy checklist',
      'provider integration is future-only',
    ]) {
      expect(readinessDoc).toContain(requiredDocPhrase);
    }
    expect(executionDoc).toContain('docs/vip-customer-delivery-readiness-checklist.md');
    expect(readinessDoc).not.toMatch(/[A-Z0-9._%+-]+@gmail\.com|[A-Z0-9._%+-]+@naver\.com/i);
    expect(readinessDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a pure customer marketing consent model plan without migration, writes, or provider integration', () => {
    const consentPlan = buildCustomerMarketingConsentModelPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');

    expect(consentPlan.consentModelEnabled).toBe(false);
    expect(consentPlan.migrationRequiredBeforeExecution).toBe(true);
    expect(consentPlan.productionWriteEnabled).toBe(false);
    expect(consentPlan.deliveryExecutionEnabled).toBe(false);
    expect(consentPlan.providerIntegrationEnabled).toBe(false);
    expect(consentPlan.allowedDeliveryStatuses).toEqual(['opted_in']);
    expect(consentPlan.blockedDeliveryStatuses).toEqual([
      'unknown',
      'opted_out',
      'withdrawn',
      'expired',
      'invalid',
    ]);
    expect(consentPlan.consentSources).toEqual([
      'public_page_form',
      'reservation_form',
      'waiting_entry',
      'manual_import',
      'pos_import',
      'owner_uploaded_list',
      'kakao_channel',
      'offline_paper',
      'unknown',
    ]);
    expect(consentPlan.requiresStoreScopedConsent).toBe(true);
    expect(consentPlan.requiresEvidence).toBe(true);
    expect(consentPlan.requiresWithdrawalOverride).toBe(true);
    expect(consentPlan.requiresOptOutExclusion).toBe(true);
    expect(consentPlan.requiresUnknownExclusion).toBe(true);
    expect(consentPlan.futureTable).toBe('customer_marketing_consents');
    expect(consentPlan.blockedActions).toEqual([
      'create_consent_table',
      'write_consent_record',
      'read_real_customer_consent',
      'send_sms',
      'send_kakao',
      'send_email',
      'execute_campaign',
      'resolve_raw_recipient',
    ]);
    expect(serviceSource).not.toMatch(/createConsentTable|writeConsentRecord|readRealCustomerConsent/i);
    expect(serviceSource).not.toMatch(/sendSms|sendKakao|sendEmail|scheduleSend|executeCampaign|resolveRawRecipient|providerClient|fetch\(|axios/i);
  });

  it('documents the customer marketing consent model without SQL, real PII, or send UI scope', () => {
    const consentDoc = readFileSync(join(process.cwd(), 'docs/customer-marketing-consent-model.md'), 'utf8');
    const readinessDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-readiness-checklist.md'), 'utf8');
    const executionDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'), 'utf8');
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');
    const changedDocBundle = [consentDoc, readinessDoc, executionDoc].join('\n');

    for (const requiredPhrase of [
      'Consent Status',
      'Consent Source',
      'Consent Timestamp',
      'Opt-Out And Withdrawal',
      'Consent Evidence',
      'Store Tenancy',
      'Future Schema Proposal',
      'customer_marketing_consents',
      'requiresMarketingConsent=true',
      'requiresOptOutExclusion=true',
      'docs/customer-marketing-consent-model.md',
    ]) {
      expect(changedDocBundle).toContain(requiredPhrase);
    }
    for (const status of ['unknown', 'opted_in', 'opted_out', 'withdrawn', 'expired', 'invalid']) {
      expect(consentDoc).toContain(status);
    }
    for (const source of [
      'public_page_form',
      'reservation_form',
      'waiting_entry',
      'manual_import',
      'pos_import',
      'owner_uploaded_list',
      'kakao_channel',
      'offline_paper',
      'unknown',
    ]) {
      expect(consentDoc).toContain(source);
    }
    expect(changedDocBundle).not.toMatch(
      new RegExp(`CREATE\\s+TABLE|ALTER\\s+TABLE|INSERT\\s+INTO|SUPABASE|${'service'}_${'role'}`, 'i'),
    );
    expect(changedDocBundle).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(changedDocBundle).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(pageSource).not.toContain('buildCustomerMarketingConsentModelPlan');
    for (const blockedUiText of [
      'send, scheduled send, or execute campaign buttons',
      'campaign execution paths',
      'consent write UI',
    ]) {
      expect(consentDoc).toContain(blockedUiText);
    }
  });

  it('builds a provider selection plan without provider integration, env changes, or delivery execution', () => {
    const providerPlan = buildVipDeliveryProviderSelectionPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const providerDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-provider-selection.md'), 'utf8');
    const consentDoc = readFileSync(join(process.cwd(), 'docs/customer-marketing-consent-model.md'), 'utf8');
    const readinessDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-readiness-checklist.md'), 'utf8');
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(providerPlan.providerSelectionOnly).toBe(true);
    expect(providerPlan.providerIntegrationEnabled).toBe(false);
    expect(providerPlan.deliveryExecutionEnabled).toBe(false);
    expect(providerPlan.apiKeyRequiredNow).toBe(false);
    expect(providerPlan.envChangeRequiredNow).toBe(false);
    expect(providerPlan.allowedChannels).toEqual([]);
    expect(providerPlan.candidateChannels).toEqual(['sms', 'kakao', 'email']);
    expect(providerPlan.requiresConsentModel).toBe(true);
    expect(providerPlan.requiresReadinessChecklist).toBe(true);
    expect(providerPlan.requiresOwnerApprovalBeforeIntegration).toBe(true);
    expect(providerPlan.evaluationCriteria).toEqual([
      'cost',
      'approval_review_required',
      'personal_data_processing',
      'api_key_management',
      'rate_limit',
      'failure_retry_policy',
      'webhook_callback_future_scope',
      'vendor_lock_in',
      'fallback_strategy',
      'consent_model_compatibility',
      'readiness_checklist_compatibility',
    ]);
    expect(providerPlan.blockedActions).toEqual([
      'install_provider_sdk',
      'add_api_key',
      'add_env',
      'import_provider_client',
      'call_provider_api',
      'send_sms',
      'send_kakao',
      'send_email',
      'schedule_send',
      'execute_campaign',
      'register_webhook',
    ]);
    expect(serviceSource).not.toMatch(/from ['"].*(twilio|sendgrid|mailgun|resend|solapi|cool.?sms|aligo|kakao)/i);
    expect(serviceSource).not.toMatch(/new\s+(Twilio|SendGrid|Mailgun|Resend)|providerClient|callProviderApi|fetch\(|axios/i);
    expect(pageSource).not.toContain('buildVipDeliveryProviderSelectionPlan');
    for (const requiredPhrase of [
      'provider selection plan only',
      'SMS Candidate Criteria',
      'Kakao Candidate Criteria',
      'Email Candidate Criteria',
      'Cost Criteria',
      'Approval And Review Criteria',
      'Personal Data Criteria',
      'API Key And Env Criteria',
      'Failure, Retry, And Rate Limit Criteria',
      'Webhook And Callback Scope',
      'Lock-In And Fallback Criteria',
      'docs/customer-marketing-consent-model.md',
      'docs/vip-customer-delivery-readiness-checklist.md',
    ]) {
      expect(providerDoc).toContain(requiredPhrase);
    }
    expect(consentDoc).toContain('docs/vip-customer-delivery-provider-selection.md');
    expect(readinessDoc).toContain('docs/vip-customer-delivery-provider-selection.md');
    expect(providerDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(providerDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });
});
