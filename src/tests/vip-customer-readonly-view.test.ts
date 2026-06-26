import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildE2eFeatureDataFlowAndChannelAuditPlan,
  buildJulyLaunchChecklistPlan,
  buildPilotConsultationRecordPlan,
  buildPilotSalesKitPlan,
  buildJulyPricingPlanLock,
  buildCustomerMarketingConsentModelPlan,
  buildVipCampaignPreparationPreview,
  buildVipDeliveryExecutionContract,
  buildVipDeliveryProviderIntegrationArchitecturePlan,
  buildVipDeliveryProviderSelectionPlan,
  buildVipDeliverySecretEnvArchitecturePlan,
  buildVipRawRecipientResolutionPlan,
  buildVipDeliveryAuditLogPlan,
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

  it('builds a provider integration architecture plan without SDKs, keys, recipient resolution, logs, or callbacks', () => {
    const architecture = buildVipDeliveryProviderIntegrationArchitecturePlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const architectureDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-provider-integration-architecture.md'),
      'utf8',
    );
    const providerSelectionDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-provider-selection.md'),
      'utf8',
    );
    const executionContractDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'),
      'utf8',
    );
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(architecture).toMatchObject({
      architectureOnly: true,
      providerIntegrationEnabled: false,
      deliveryExecutionEnabled: false,
      apiKeyRequiredNow: false,
      envChangeRequiredNow: false,
      providerSdkRequiredNow: false,
      webhookEnabledNow: false,
      rawRecipientResolutionEnabled: false,
      deliveryLogTableEnabled: false,
    });
    expect(architecture.allowedRuntimeProviders).toEqual([]);
    expect(architecture.futureProviderChannels).toEqual(['sms', 'kakao', 'email']);
    expect(architecture.requiredPreconditions).toEqual([
      'marketing_consent_model',
      'delivery_readiness_checklist',
      'owner_approval_gate',
      'delivery_execution_contract',
      'provider_selection_plan',
    ]);
    expect(architecture.futureComponents).toEqual([
      'DeliveryProviderAdapter',
      'SmsProviderAdapter',
      'KakaoProviderAdapter',
      'EmailProviderAdapter',
      'SecureSecretProvider',
      'RecipientResolver',
      'ConsentVerifier',
      'ReadinessVerifier',
      'ApprovalVerifier',
      'DeliveryAuditLogger',
      'RateLimitGuard',
      'RetryPolicy',
      'FallbackPolicy',
      'WebhookStatusReceiver',
    ]);
    expect(architecture.blockedActions).toEqual([
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
      'resolve_raw_recipient',
      'write_delivery_log',
      'create_delivery_log_table',
      'register_webhook',
      'handle_provider_callback',
    ]);
    expect(serviceSource).not.toMatch(/from ['"].*(twilio|sendgrid|mailgun|resend|solapi|cool.?sms|aligo|kakao)/i);
    expect(serviceSource).not.toMatch(/\b(fetch|axios)\s*\(|callProviderApi|createProviderClient|sendSms|sendKakao|sendEmail/i);
    expect(pageSource).not.toContain('buildVipDeliveryProviderIntegrationArchitecturePlan');
    for (const requiredPhrase of [
      'provider integration architecture plan only',
      'Future Architecture Flow',
      'Future Components',
      'Secret And Env Architecture',
      'Provider Adapter Architecture',
      'Recipient Resolution Boundary',
      'Audit Log And Delivery Log Boundary',
      'Webhook And Callback Boundary',
      'Failure, Retry, And Fallback Architecture',
      'docs/vip-customer-delivery-provider-selection.md',
      'docs/vip-customer-delivery-execution-contract.md',
    ]) {
      expect(architectureDoc).toContain(requiredPhrase);
    }
    expect(providerSelectionDoc).toContain('docs/vip-customer-delivery-provider-integration-architecture.md');
    expect(executionContractDoc).toContain('docs/vip-customer-delivery-provider-integration-architecture.md');
    expect(architectureDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(architectureDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a Secret/Env Architecture plan without adding keys, env, provider imports, or execution paths', () => {
    const secretEnvPlan = buildVipDeliverySecretEnvArchitecturePlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const secretEnvDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-secret-env-architecture.md'),
      'utf8',
    );
    const architectureDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-provider-integration-architecture.md'),
      'utf8',
    );
    const pageSource = readFileSync(join(process.cwd(), 'src/modules/customers/page.tsx'), 'utf8');

    expect(secretEnvPlan).toMatchObject({
      secretEnvArchitectureOnly: true,
      apiKeyAdded: false,
      envAdded: false,
      apiKeyRequiredNow: false,
      envChangeRequiredNow: false,
      providerSdkRequiredNow: false,
      providerImportEnabled: false,
      providerIntegrationEnabled: false,
      deliveryExecutionEnabled: false,
      webhookEnabledNow: false,
      productionWriteEnabled: false,
      realCustomerDataReadEnabled: false,
    });
    expect(secretEnvPlan.allowedSecretNames).toEqual([]);
    expect(secretEnvPlan.requiredRuntimeEnvVars).toEqual([]);
    expect(secretEnvPlan.publicClientEnvAllowed).toEqual([]);
    expect(secretEnvPlan.futureSecretScopes).toEqual(['local', 'preview', 'production']);
    expect(secretEnvPlan.linkedContracts).toEqual([
      'provider_integration_architecture',
      'provider_selection_plan',
      'delivery_execution_contract',
      'marketing_consent_model',
      'delivery_readiness_checklist',
    ]);
    expect(secretEnvPlan.requiredControls).toEqual([
      'server_only_secret_boundary',
      'environment_separation',
      'owner_approval_before_key_creation',
      'secret_rotation_plan',
      'emergency_revocation_plan',
      'least_privilege_provider_account',
      'redacted_logging_policy',
      'no_client_public_secret',
      'no_build_output_secret',
      'no_pr_comment_secret',
    ]);
    expect(secretEnvPlan.blockedActions).toEqual([
      'add_api_key',
      'add_env',
      'commit_env_file',
      'expose_secret_in_client_bundle',
      'install_provider_sdk',
      'import_provider_client',
      'call_provider_api',
      'register_webhook',
      'send_sms',
      'send_kakao',
      'send_email',
      'schedule_send',
      'execute_campaign',
      'log_secret_value',
      'store_secret_value',
      'read_secret_value',
      'read_real_customer_data',
    ]);
    expect(serviceSource).not.toMatch(/from ['"].*(twilio|sendgrid|mailgun|resend|solapi|cool.?sms|aligo|kakao)/i);
    expect(serviceSource).not.toMatch(/\b(fetch|axios)\s*\(|process\.env|import\.meta\.env|callProviderApi|createProviderClient/i);
    expect(pageSource).not.toContain('buildVipDeliverySecretEnvArchitecturePlan');
    for (const requiredPhrase of [
      'Secret/Env Architecture plan only',
      'server-only secrets',
      'Environment Separation',
      'API Key Lifecycle',
      'Logging And Evidence',
      'provider_secret_configured=true',
      'allowedSecretNames: []',
      'requiredRuntimeEnvVars: []',
      'publicClientEnvAllowed: []',
      'docs/vip-customer-delivery-provider-integration-architecture.md',
      'docs/vip-customer-delivery-provider-selection.md',
    ]) {
      expect(secretEnvDoc).toContain(requiredPhrase);
    }
    expect(secretEnvDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(secretEnvDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(secretEnvDoc).not.toMatch(/NEXT_PUBLIC_|VITE_|process\.env|import\.meta\.env/);
    expect(architectureDoc).toContain('docs/vip-customer-delivery-secret-env-architecture.md');
  });

  it('builds a raw recipient resolution boundary plan without raw access, provider calls, or delivery writes', () => {
    const rawRecipientPlan = buildVipRawRecipientResolutionPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const rawRecipientDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-raw-recipient-resolution-plan.md'),
      'utf8',
    );
    const consentDoc = readFileSync(join(process.cwd(), 'docs/customer-marketing-consent-model.md'), 'utf8');
    const secretEnvDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-secret-env-architecture.md'),
      'utf8',
    );

    expect(rawRecipientPlan).toMatchObject({
      rawRecipientResolutionEnabled: false,
      maskedPreviewOnly: true,
      deliveryExecutionEnabled: false,
      providerIntegrationEnabled: false,
      productionWriteEnabled: false,
      requiresOwnerApproval: true,
      requiresMarketingConsent: true,
      requiresStoreScopedConsent: true,
      requiresSecureExecutionScope: true,
      requiresAuditLog: true,
      requiresOptOutExclusion: true,
    });
    expect(rawRecipientPlan.allowedNow).toEqual([]);
    expect(rawRecipientPlan.futureResolutionFields).toEqual(['phone', 'email']);
    expect(rawRecipientPlan.blockedStatuses).toEqual(['unknown', 'opted_out', 'withdrawn', 'expired', 'invalid']);
    expect(rawRecipientPlan.blockedActions).toEqual([
      'read_raw_phone',
      'read_raw_email',
      'resolve_raw_recipient',
      'export_recipient_list',
      'send_sms',
      'send_kakao',
      'send_email',
      'execute_campaign',
      'write_delivery_log',
    ]);
    expect(JSON.stringify(rawRecipientPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(rawRecipientPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /readRawPhone|readRawEmail|resolveRawRecipient|exportRecipientList|writeDeliveryLog|sendSms|sendKakao|sendEmail/i,
    );
    expect(serviceSource).not.toMatch(/\b(fetch|axios)\s*\(|from ['"].*(twilio|sendgrid|mailgun|resend|solapi|aligo|kakao)/i);

    for (const requiredPhrase of [
      'raw recipient resolution plan only',
      'masked preview only',
      'Raw phone and email access remains future-only',
      'Consent And Opt-Out Boundary',
      'Store Tenancy Boundary',
      'Secret/Env Boundary',
      'Audit Boundary',
      'blockedStatuses: ["unknown", "opted_out", "withdrawn", "expired", "invalid"]',
      'docs/customer-marketing-consent-model.md',
      'docs/vip-customer-delivery-secret-env-architecture.md',
    ]) {
      expect(rawRecipientDoc).toContain(requiredPhrase);
    }
    expect(consentDoc).toContain('docs/vip-customer-raw-recipient-resolution-plan.md');
    expect(secretEnvDoc).toContain('docs/vip-customer-raw-recipient-resolution-plan.md');
    expect(rawRecipientDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(rawRecipientDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a delivery audit log plan without migrations, raw recipient storage, or delivery writes', () => {
    const auditLogPlan = buildVipDeliveryAuditLogPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const auditLogDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-delivery-audit-log-plan.md'), 'utf8');
    const rawRecipientDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-raw-recipient-resolution-plan.md'),
      'utf8',
    );
    const executionContractDoc = readFileSync(
      join(process.cwd(), 'docs/vip-customer-delivery-execution-contract.md'),
      'utf8',
    );

    expect(auditLogPlan).toMatchObject({
      auditLogPlanOnly: true,
      deliveryLogTableEnabled: false,
      migrationRequiredBeforeExecution: true,
      productionWriteEnabled: false,
      rawRecipientStorageEnabled: false,
      requiresOwnerApproval: true,
      requiresMaskedRecipientSnapshot: true,
      requiresMessageBodyHash: true,
      requiresRecipientCount: true,
      requiresExecutionStatus: true,
      requiresFailureReason: true,
      requiresCancellationReason: true,
      futureTable: 'vip_delivery_audit_logs',
    });
    expect(auditLogPlan.futureFields).toEqual([
      'delivery_audit_id',
      'store_id',
      'campaign_id',
      'approved_by',
      'approved_at',
      'approval_snapshot',
      'recipient_count',
      'masked_recipient_snapshot',
      'message_template_id',
      'message_body_hash',
      'provider',
      'channel',
      'execution_status',
      'failure_reason',
      'cancellation_reason',
      'created_at',
    ]);
    expect(auditLogPlan.blockedActions).toEqual([
      'create_delivery_log_table',
      'write_delivery_log',
      'store_raw_recipient',
      'store_raw_phone',
      'store_raw_email',
      'execute_campaign',
      'send_sms',
      'send_kakao',
      'send_email',
      'register_webhook',
    ]);
    expect(JSON.stringify(auditLogPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(auditLogPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /createDeliveryLogTable|writeDeliveryLog|storeRawRecipient|storeRawPhone|storeRawEmail|sendSms|sendKakao|sendEmail|registerWebhook|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'audit log plan only',
      'does not create the `vip_delivery_audit_logs` table',
      'migration remains prohibited',
      'production write remains prohibited',
      'raw recipient storage remains prohibited',
      'masked_recipient_snapshot',
      'message_body_hash',
      'failure_reason',
      'cancellation_reason',
      'docs/vip-customer-raw-recipient-resolution-plan.md',
      'docs/vip-customer-delivery-execution-contract.md',
    ]) {
      expect(auditLogDoc).toContain(requiredPhrase);
    }
    expect(rawRecipientDoc).toContain('docs/vip-customer-delivery-audit-log-plan.md');
    expect(executionContractDoc).toContain('docs/vip-customer-delivery-audit-log-plan.md');
    expect(auditLogDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(auditLogDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a July launch checklist plan without production side effects', () => {
    const launchPlan = buildJulyLaunchChecklistPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const checklistDoc = readFileSync(join(process.cwd(), 'docs/july-launch-checklist.md'), 'utf8');
    const launchScopeDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-memory-launch-scope.md'), 'utf8');

    expect(launchPlan).toMatchObject({
      actualDeliveryEnabled: false,
      deliveryLogWriteEnabled: false,
      launchMode: 'pilot_readonly_revenue_engine',
      launchPlanOnly: true,
      paymentAutomationEnabled: false,
      productionSideEffectsEnabled: false,
      providerIntegrationEnabled: false,
      rawRecipientResolutionEnabled: false,
      requiresDemoScenario: true,
      requiresOwnerApprovalBeforeLaunch: true,
      requiresPilotStoreSelection: true,
      requiresPricingPlanLock: true,
      requiresPrivacyConsentReview: true,
      targetMonth: '2026-07',
    });
    expect(launchPlan.openScope).toEqual([
      'vip_customer_memory_readonly',
      'vip_criteria_report_sample',
      'vip_campaign_preparation_preview',
      'delivery_approval_gate',
      'delivery_execution_contract',
      'delivery_readiness_checklist',
      'customer_marketing_consent_model',
      'provider_selection_plan',
      'provider_integration_architecture',
      'secret_env_architecture',
      'raw_recipient_resolution_boundary',
      'delivery_audit_log_plan',
      'public_pricing_domain_pages',
      'actual_delivery_disabled',
    ]);
    expect(launchPlan.notOpenScope).toEqual([
      'actual_sms_kakao_email_send',
      'provider_integration',
      'api_key_env_registration',
      'raw_phone_email_resolution',
      'recipient_export',
      'delivery_log_table_write',
      'webhook_callback',
      'payment_billing_automation',
      'production_db_migration_write',
    ]);
    expect(launchPlan.blockedActions).toEqual([
      'send_sms',
      'send_kakao',
      'send_email',
      'resolve_raw_recipient',
      'export_recipient_list',
      'write_delivery_log',
      'create_migration',
      'add_api_key',
      'add_env',
      'register_webhook',
      'enable_payment_automation',
    ]);
    expect(JSON.stringify(launchPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(launchPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /resolveRawRecipient|exportRecipientList|writeDeliveryLog|sendSms|sendKakao|sendEmail|registerWebhook|enablePaymentAutomation|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'July 2026 Launch Checklist',
      'Open Scope For July Pilot',
      'Not Open Scope',
      'Pilot Store Onboarding Checklist',
      'Demo Scenario',
      'Pricing And Plan Lock',
      'Privacy And Consent Review',
      'Delivery Owner Approval Checklist',
      'Provider, Env, And Key Status',
      'Raw Recipient And Audit Status',
      'Operational Risk Controls',
      'buildJulyLaunchChecklistPlan()',
    ]) {
      expect(checklistDoc).toContain(requiredPhrase);
    }
    for (const requiredPhrase of [
      'VIP Customer Memory Launch Scope',
      'Launchable Scope',
      'Not Launchable Scope',
      'Pilot Store Conditions',
      'Pricing Lock',
      'Privacy And Consent',
      'docs/july-launch-checklist.md',
    ]) {
      expect(launchScopeDoc).toContain(requiredPhrase);
    }
    expect(checklistDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(checklistDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(launchScopeDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(launchScopeDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a July pricing plan lock without payment automation or subscription writes', () => {
    const pricingLock = buildJulyPricingPlanLock();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const pricingDoc = readFileSync(join(process.cwd(), 'docs/july-pricing-plan-lock.md'), 'utf8');
    const checklistDoc = readFileSync(join(process.cwd(), 'docs/july-launch-checklist.md'), 'utf8');
    const launchScopeDoc = readFileSync(join(process.cwd(), 'docs/vip-customer-memory-launch-scope.md'), 'utf8');

    expect(pricingLock).toMatchObject({
      billingWebhookEnabled: false,
      paymentAutomationEnabled: false,
      positioning: 'memory_based_revenue_engine',
      pricingPlanOnly: true,
      productionSideEffectsEnabled: false,
      requiresOwnerApprovalBeforePublishing: true,
      requiresPilotFeedbackBeforeFinalPrice: true,
      subscriptionWriteEnabled: false,
      targetMonth: '2026-07',
    });
    expect(pricingLock.recommendedPlans).toEqual([
      {
        code: 'free',
        name: 'Free',
        monthlyPriceKrw: 0,
        role: 'lead_capture_and_demo',
      },
      {
        code: 'starter',
        name: 'Starter',
        monthlyPriceKrw: 29000,
        role: 'paid_entry_memory_card',
      },
      {
        code: 'growth',
        name: 'Growth',
        monthlyPriceKrw: 99000,
        role: 'core_memory_revenue_engine',
      },
      {
        code: 'pro',
        name: 'Pro',
        monthlyPriceKrw: 199000,
        role: 'advanced_operations_and_reports',
      },
      {
        code: 'franchise',
        name: 'Franchise',
        monthlyPriceKrw: null,
        role: 'multi_store_and_template_package',
        startsFromKrw: 499000,
      },
    ]);
    expect(pricingLock.blockedActions).toEqual([
      'create_subscription',
      'write_subscription',
      'charge_payment',
      'enable_payment_automation',
      'register_billing_webhook',
      'add_pg_provider',
      'add_api_key',
      'add_env',
      'send_sms',
      'send_kakao',
      'send_email',
      'resolve_raw_recipient',
    ]);
    expect(serviceSource).not.toMatch(
      /createSubscription|writeSubscription|chargePayment|enablePaymentAutomation|registerBillingWebhook|addPgProvider|sendSms|sendKakao|sendEmail|resolveRawRecipient|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'July 2026 Pricing Plan Lock',
      'memory-based revenue engine',
      'Growth is the core paid plan',
      'Payment And Billing Boundary',
      'payment automation: disabled',
      'billing webhook: disabled',
      'subscription write: disabled',
      'Delivery Boundary',
      'Owner Approval And Pilot Feedback',
      'buildJulyPricingPlanLock()',
    ]) {
      expect(pricingDoc).toContain(requiredPhrase);
    }
    expect(checklistDoc).toContain('docs/july-pricing-plan-lock.md');
    expect(launchScopeDoc).toContain('docs/july-pricing-plan-lock.md');
    expect(pricingDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(pricingDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a pilot store onboarding plan without production side effects', async () => {
    const serviceModule = await import('@/shared/lib/services/vipCustomerReadonlyViewService');
    const maybeBuilder = (serviceModule as Record<string, unknown>).buildPilotStoreOnboardingPlan;

    expect(typeof maybeBuilder).toBe('function');

    const onboardingPlan = (maybeBuilder as () => {
      actualDeliveryEnabled: false;
      blockedActions: string[];
      customerDataImportEnabled: false;
      onboardingPlanOnly: true;
      paymentAutomationEnabled: false;
      positioning: 'memory_based_revenue_engine';
      prioritySegments: string[];
      productionSideEffectsEnabled: false;
      providerIntegrationEnabled: false;
      rawRecipientResolutionEnabled: false;
      recommendedPrimaryMonthlyPriceKrw: 99000;
      recommendedPrimaryPlan: 'growth';
      requiresDemoScenario: true;
      requiresOwnerApprovalBeforePilot: true;
      requiresPricingPlanLock: true;
      requiresPrivacyConsentReview: true;
      storeCreationEnabled: false;
      targetMonth: '2026-07';
      targetPilotStoreCount: { max: 5; min: 3 };
    })();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const onboardingDoc = readFileSync(join(process.cwd(), 'docs/pilot-store-onboarding-checklist.md'), 'utf8');
    const demoDoc = readFileSync(join(process.cwd(), 'docs/pilot-demo-scenario.md'), 'utf8');
    const checklistDoc = readFileSync(join(process.cwd(), 'docs/july-launch-checklist.md'), 'utf8');
    const pricingDoc = readFileSync(join(process.cwd(), 'docs/july-pricing-plan-lock.md'), 'utf8');

    expect(onboardingPlan).toMatchObject({
      actualDeliveryEnabled: false,
      customerDataImportEnabled: false,
      onboardingPlanOnly: true,
      paymentAutomationEnabled: false,
      positioning: 'memory_based_revenue_engine',
      productionSideEffectsEnabled: false,
      providerIntegrationEnabled: false,
      rawRecipientResolutionEnabled: false,
      recommendedPrimaryMonthlyPriceKrw: 99000,
      recommendedPrimaryPlan: 'growth',
      requiresDemoScenario: true,
      requiresOwnerApprovalBeforePilot: true,
      requiresPricingPlanLock: true,
      requiresPrivacyConsentReview: true,
      storeCreationEnabled: false,
      targetMonth: '2026-07',
      targetPilotStoreCount: {
        max: 5,
        min: 3,
      },
    });
    expect(onboardingPlan.prioritySegments).toEqual(['restaurant', 'cafe', 'dessert']);
    expect(onboardingPlan.blockedActions).toEqual([
      'create_store',
      'import_customer_data',
      'read_real_customer_data',
      'resolve_raw_recipient',
      'export_recipient_list',
      'send_sms',
      'send_kakao',
      'send_email',
      'charge_payment',
      'create_subscription',
      'write_subscription',
      'add_api_key',
      'add_env',
      'register_webhook',
    ]);
    expect(JSON.stringify(onboardingPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(onboardingPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /createStore|importCustomerData|readRealCustomerData|resolveRawRecipient|exportRecipientList|sendSms|sendKakao|sendEmail|chargePayment|createSubscription|writeSubscription|addApiKey|addEnv|registerWebhook|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'Pilot Store Onboarding Checklist',
      '7월 파일럿 목표',
      '파일럿 매장 3~5곳',
      '음식점/카페/디저트 우선',
      '기억 기반 매출 엔진',
      '우선 타깃 매장',
      '제외',
      '파일럿 제안 조건',
      'Growth 99,000원',
      '실제 발송은 미포함',
      'buildPilotStoreOnboardingPlan()',
    ]) {
      expect(onboardingDoc).toContain(requiredPhrase);
    }
    for (const requiredPhrase of [
      'Pilot Demo Scenario',
      '사장님 현재 문제 확인',
      'MyBiz 가치 제시',
      '돈 받을 포인트',
      '안전 경계 설명',
      'read-only revenue proof',
    ]) {
      expect(demoDoc).toContain(requiredPhrase);
    }
    expect(checklistDoc).toContain('docs/pilot-store-onboarding-checklist.md');
    expect(checklistDoc).toContain('docs/pilot-demo-scenario.md');
    expect(pricingDoc).toContain('docs/pilot-store-onboarding-checklist.md');
    expect(onboardingDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(onboardingDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(demoDoc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(demoDoc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
  });

  it('builds a pilot sales kit plan without outbound, payment, or customer-data side effects', () => {
    const salesKitPlan = buildPilotSalesKitPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const salesKitDoc = readFileSync(join(process.cwd(), 'docs/pilot-sales-kit.md'), 'utf8');
    const objectionDoc = readFileSync(join(process.cwd(), 'docs/pilot-objection-handling.md'), 'utf8');
    const onboardingDoc = readFileSync(join(process.cwd(), 'docs/pilot-store-onboarding-checklist.md'), 'utf8');
    const demoDoc = readFileSync(join(process.cwd(), 'docs/pilot-demo-scenario.md'), 'utf8');

    expect(salesKitPlan).toMatchObject({
      actualDeliveryEnabled: false,
      customerDataImportEnabled: false,
      outboundEnabled: false,
      paymentAutomationEnabled: false,
      positioning: 'memory_based_revenue_engine',
      primaryOfferMonthlyPriceKrw: 99000,
      primaryOfferPlan: 'growth',
      providerIntegrationEnabled: false,
      rawRecipientResolutionEnabled: false,
      requiresOwnerApprovalBeforeUse: true,
      requiresPrivacyBoundaryExplanation: true,
      requiresReadOnlyPilotExplanation: true,
      salesKitPlanOnly: true,
      storeCreationEnabled: false,
      targetMonth: '2026-07',
      targetPilotStoreCount: {
        max: 5,
        min: 3,
      },
    });
    expect(salesKitPlan.requiredSalesAssets).toEqual([
      'three_minute_pitch',
      'thirty_second_pitch',
      'pricing_pitch',
      'objection_handling',
      'pre_contract_checklist',
    ]);
    expect(salesKitPlan.blockedActions).toEqual([
      'send_sales_sms',
      'send_sales_kakao',
      'send_sales_email',
      'create_store',
      'import_customer_data',
      'read_real_customer_data',
      'charge_payment',
      'create_subscription',
      'write_subscription',
      'resolve_raw_recipient',
      'add_api_key',
      'add_env',
      'register_webhook',
    ]);
    expect(JSON.stringify(salesKitPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(salesKitPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /sendSalesSms|sendSalesKakao|sendSalesEmail|createStore|importCustomerData|readRealCustomerData|chargePayment|createSubscription|writeSubscription|resolveRawRecipient|addApiKey|addEnv|registerWebhook|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'Pilot Sales Kit',
      'memory-based revenue engine SaaS',
      '3분 설명 스크립트',
      '30초 한 줄 제안',
      '가격 제안 멘트',
      'Pre-Contract Checklist',
      'Growth 99,000',
      'buildPilotSalesKitPlan()',
    ]) {
      expect(salesKitDoc).toContain(requiredPhrase);
    }
    for (const requiredPhrase of [
      'Pilot Objection Handling',
      '우리는 단골 다 기억해요',
      '문자 자동 발송 하는 거예요',
      'CRM이랑 뭐가 달라요',
      '비싸요',
      '개인정보 괜찮아요',
      '지금 당장 필요한가요',
      'buildPilotSalesKitPlan()',
    ]) {
      expect(objectionDoc).toContain(requiredPhrase);
    }
    expect(onboardingDoc).toContain('docs/pilot-sales-kit.md');
    expect(onboardingDoc).toContain('docs/pilot-objection-handling.md');
    expect(demoDoc).toContain('docs/pilot-sales-kit.md');
    expect(demoDoc).toContain('docs/pilot-objection-handling.md');
    for (const doc of [salesKitDoc, objectionDoc]) {
      expect(doc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
      expect(doc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
      expect(doc).not.toMatch(/automatic customer grade changes|payment automation enabled|provider integration enabled/i);
    }
  });

  it('builds a pilot consultation record plan without lead, store, payment, or customer-data writes', () => {
    const consultationPlan = buildPilotConsultationRecordPlan();
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');
    const consultationDoc = readFileSync(join(process.cwd(), 'docs/pilot-consultation-record-template.md'), 'utf8');
    const preContractDoc = readFileSync(join(process.cwd(), 'docs/pilot-pre-contract-checklist.md'), 'utf8');
    const salesKitDoc = readFileSync(join(process.cwd(), 'docs/pilot-sales-kit.md'), 'utf8');
    const onboardingDoc = readFileSync(join(process.cwd(), 'docs/pilot-store-onboarding-checklist.md'), 'utf8');

    expect(consultationPlan).toMatchObject({
      actualDeliveryEnabled: false,
      consultationRecordPlanOnly: true,
      customerDataImportEnabled: false,
      leadCreationEnabled: false,
      paymentAutomationEnabled: false,
      positioning: 'memory_based_revenue_engine',
      primaryOfferMonthlyPriceKrw: 99000,
      primaryOfferPlan: 'growth',
      productionWriteEnabled: false,
      providerIntegrationEnabled: false,
      rawRecipientResolutionEnabled: false,
      realCustomerDataReadEnabled: false,
      recordTemplateOnly: true,
      requiresOwnerApprovalBeforeUse: true,
      requiresPrivacyBoundaryExplanation: true,
      requiresReadOnlyPilotExplanation: true,
      storeCreationEnabled: false,
      targetMonth: '2026-07',
    });
    expect(consultationPlan.conversionGrades).toEqual(['hot', 'warm', 'cold', 'no_fit']);
    expect(consultationPlan.possibleNextActions).toEqual([
      'propose_growth',
      'propose_starter',
      'schedule_follow_up',
      'mark_not_fit',
    ]);
    expect(consultationPlan.requiredRecordFields).toEqual([
      'consultation_date',
      'business_type',
      'current_customer_management',
      'regular_customer_pattern',
      'preference_importance',
      'revisit_need',
      'average_order_value_opportunity',
      'main_pain_point',
      'interested_features',
      'growth_price_reaction',
      'objections',
      'privacy_consent_readiness',
      'readonly_pilot_understood',
      'actual_delivery_excluded_understood',
      'next_action',
      'conversion_grade',
    ]);
    expect(consultationPlan.blockedActions).toEqual([
      'write_consultation_record',
      'create_lead',
      'create_store',
      'import_customer_data',
      'read_real_customer_data',
      'charge_payment',
      'create_subscription',
      'write_subscription',
      'send_sales_sms',
      'send_sales_kakao',
      'send_sales_email',
      'resolve_raw_recipient',
      'add_api_key',
      'add_env',
      'register_webhook',
    ]);
    expect(JSON.stringify(consultationPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(consultationPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /writeConsultationRecord|createLead|createStore|importCustomerData|readRealCustomerData|chargePayment|createSubscription|writeSubscription|sendSalesSms|sendSalesKakao|sendSalesEmail|resolveRawRecipient|addApiKey|addEnv|registerWebhook|providerClient|fetch\(|axios/i,
    );

    for (const requiredPhrase of [
      'Pilot Consultation Record Template',
      '상담 기록 템플릿',
      '전환 가능성 등급',
      'HOT',
      'WARM',
      'COLD',
      'NO_FIT',
      'Growth 99,000',
      'write_consultation_record',
      'buildPilotConsultationRecordPlan()',
    ]) {
      expect(consultationDoc).toContain(requiredPhrase);
    }
    for (const requiredPhrase of [
      'Pilot Pre-Contract Checklist',
      '계약 전 필수 확인',
      '파일럿 성공 기준',
      'Growth 99,000',
      'read-only 파일럿',
      'raw phone/email',
      'buildPilotConsultationRecordPlan()',
    ]) {
      expect(preContractDoc).toContain(requiredPhrase);
    }
    expect(salesKitDoc).toContain('docs/pilot-consultation-record-template.md');
    expect(salesKitDoc).toContain('docs/pilot-pre-contract-checklist.md');
    expect(onboardingDoc).toContain('docs/pilot-consultation-record-template.md');
    expect(onboardingDoc).toContain('docs/pilot-pre-contract-checklist.md');
    for (const doc of [consultationDoc, preContractDoc]) {
      expect(doc).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
      expect(doc).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
      expect(doc).not.toMatch(/lead created|store created|payment automation enabled|provider integration enabled/i);
    }
  });

  it('builds an E2E feature data-flow and channel audit plan without channel, payment, or data side effects', () => {
    const auditPlan = buildE2eFeatureDataFlowAndChannelAuditPlan();
    const e2eDoc = readFileSync(join(process.cwd(), 'docs/e2e-feature-data-flow-audit.md'), 'utf8');
    const channelDoc = readFileSync(join(process.cwd(), 'docs/channel-integration-readiness-audit.md'), 'utf8');
    const launchChecklist = readFileSync(join(process.cwd(), 'docs/july-launch-checklist.md'), 'utf8');
    const serviceSource = readFileSync(join(process.cwd(), 'src/shared/lib/services/vipCustomerReadonlyViewService.ts'), 'utf8');

    expect(auditPlan).toMatchObject({
      auditPlanOnly: true,
      blogAutoPublishingEnabled: false,
      dataFlowExecutionEnabled: false,
      launchMode: 'pilot_readonly_revenue_engine',
      paymentAutomationEnabled: false,
      positioning: 'memory_based_revenue_engine',
      productionSideEffectsEnabled: false,
      providerIntegrationEnabled: false,
      rawRecipientResolutionEnabled: false,
      realCustomerDataReadEnabled: false,
      socialPublishingEnabled: false,
      targetMonth: '2026-07',
    });
    expect(auditPlan.requiredAuditAreas).toEqual([
      'feature_matrix',
      'data_flow_map',
      'blocked_flow_map',
      'channel_integration_readiness',
      'youtube_readiness',
      'instagram_readiness',
      'threads_readiness',
      'blog_readiness',
      'analytics_gap',
      'launch_risk',
    ]);
    expect(auditPlan.channelStatuses).toEqual([
      {
        channel: 'youtube',
        launchRecommendation: 'manual_upload_or_link_only',
        status: 'not_implemented',
      },
      {
        channel: 'instagram',
        launchRecommendation: 'manual_post_or_content_checklist_only',
        status: 'not_implemented',
      },
      {
        channel: 'threads',
        launchRecommendation: 'manual_post_or_content_checklist_only',
        status: 'not_implemented',
      },
      {
        channel: 'blog',
        launchRecommendation: 'manual_publish_or_markdown_pipeline_only',
        status: 'needs_verification',
      },
    ]);
    expect(auditPlan.blockedActions).toEqual([
      'call_youtube_api',
      'call_instagram_api',
      'call_threads_api',
      'publish_blog_post',
      'add_oauth_client',
      'add_api_key',
      'add_env',
      'upload_video',
      'publish_social_post',
      'write_customer_data',
      'create_store',
      'create_lead',
      'charge_payment',
      'send_sms',
      'send_kakao',
      'send_email',
      'resolve_raw_recipient',
    ]);

    for (const requiredPhrase of [
      'E2E Feature Data Flow Audit',
      'current openable features',
      'not open yet',
      'core data flow audit',
      'blocked risk flows',
      'analytics gap',
      'launch risk',
      'pilot consultation record template',
    ]) {
      expect(e2eDoc).toContain(requiredPhrase);
    }
    for (const requiredPhrase of [
      'Channel Integration Readiness Audit',
      'YouTube',
      'Instagram',
      'Threads',
      'Blog',
      'not_implemented',
      'needs_verification',
      'manual upload',
      'manual post',
      'manual publish',
    ]) {
      expect(channelDoc).toContain(requiredPhrase);
    }
    expect(launchChecklist).toContain('docs/e2e-feature-data-flow-audit.md');
    expect(launchChecklist).toContain('docs/channel-integration-readiness-audit.md');
    expect(JSON.stringify(auditPlan)).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(JSON.stringify(auditPlan)).not.toMatch(/[A-Z0-9._%+-]+@(gmail|naver)\.com/i);
    expect(serviceSource).not.toMatch(
      /callYoutubeApi|callInstagramApi|callThreadsApi|publishBlogPost|addOauthClient|addApiKey|addEnv|uploadVideo|publishSocialPost|writeCustomerData|createStore|createLead|chargePayment|sendSms|sendKakao|sendEmail|resolveRawRecipient|providerClient|fetch\(|axios/i,
    );
  });
});
