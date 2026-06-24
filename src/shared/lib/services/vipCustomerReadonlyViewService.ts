import type {
  Customer,
  CustomerPreference,
  CustomerTimelineEvent,
  Order,
  StoreSubscription,
  SubscriptionPlan,
} from '../../types/models.js';

type CustomerVipFieldSource = Customer & {
  customer_value?: number;
  is_vip?: boolean;
  lifetime_value?: number;
  order_count?: number;
  segment?: string;
  tags?: string[];
  tier?: string;
  vip?: boolean;
};

export type VipCustomerReason =
  | 'explicit_vip_field'
  | 'lifetime_value_threshold'
  | 'order_count_threshold'
  | 'segment_or_tag'
  | 'visit_count_threshold';

export interface VipCustomerReadonlyCard {
  allowedActions: [];
  customerId: string;
  expectedNextAction: string;
  lastActivityAt?: string;
  maskedContact: string;
  maskedDisplayName: string;
  orderCount: number;
  preferenceSummary: string;
  profileSummaryText: string;
  readOnly: true;
  recentEventSummary: string;
  totalOrderAmount: number;
  totalVisitCount: number;
  vipReasons: VipCustomerReason[];
}

export interface VipCustomerReadonlyView {
  emptyState: {
    description: string;
    title: string;
  };
  readOnlyNotice: string;
  summary: {
    storeId: string;
    storeSubscriptionPlan?: SubscriptionPlan;
    subscriptionPlanIsCustomerVipSource: false;
    totalCustomersReviewed: number;
    vipCustomerCount: number;
  };
  vipCustomers: VipCustomerReadonlyCard[];
}

export type VipCustomerReportSectionId = 'dormancy_risk' | 'revisit_this_week' | 'raise_average_order_value';

export interface VipCustomerReadonlyReportCandidate {
  customerId: string;
  maskedContact: string;
  maskedDisplayName: string;
  reasonSummary: string;
  totalOrderAmount: number;
  totalVisitCount: number;
}

export interface VipCustomerReadonlyReportSection {
  candidates: VipCustomerReadonlyReportCandidate[];
  description: string;
  id: VipCustomerReportSectionId;
  title: string;
}

export interface VipCustomerReadonlyReportSample {
  allowedActions: [];
  readOnlyNotice: string;
  sections: VipCustomerReadonlyReportSection[];
  summary: VipCustomerReadonlyView['summary'] & {
    campaignGateRequired: true;
    reportMode: 'sample_read_only';
  };
}

export type VipCampaignPreparationBlockedAction =
  | 'execute_campaign'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms'
  | 'update_customer';

export type VipDeliveryApprovalBlockedAction =
  | 'execute_campaign'
  | 'schedule_send'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms';

export type VipDeliveryExecutionBlockedAction =
  | 'create_campaign_execution'
  | 'execute_campaign'
  | 'resolve_raw_recipient'
  | 'schedule_send'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms'
  | 'write_delivery_log';

export type VipDeliveryExecutionFutureChannel = 'email' | 'kakao' | 'sms';

export type CustomerMarketingConsentStatus =
  | 'expired'
  | 'invalid'
  | 'opted_in'
  | 'opted_out'
  | 'unknown'
  | 'withdrawn';

export type CustomerMarketingConsentSource =
  | 'kakao_channel'
  | 'manual_import'
  | 'offline_paper'
  | 'owner_uploaded_list'
  | 'pos_import'
  | 'public_page_form'
  | 'reservation_form'
  | 'unknown'
  | 'waiting_entry';

export type CustomerMarketingConsentBlockedAction =
  | 'create_consent_table'
  | 'execute_campaign'
  | 'read_real_customer_consent'
  | 'resolve_raw_recipient'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms'
  | 'write_consent_record';

export type VipDeliveryProviderSelectionCandidateChannel = 'email' | 'kakao' | 'sms';

export type VipDeliveryProviderSelectionCriteria =
  | 'api_key_management'
  | 'approval_review_required'
  | 'consent_model_compatibility'
  | 'cost'
  | 'failure_retry_policy'
  | 'fallback_strategy'
  | 'personal_data_processing'
  | 'rate_limit'
  | 'readiness_checklist_compatibility'
  | 'vendor_lock_in'
  | 'webhook_callback_future_scope';

export type VipDeliveryProviderSelectionBlockedAction =
  | 'add_api_key'
  | 'add_env'
  | 'call_provider_api'
  | 'execute_campaign'
  | 'import_provider_client'
  | 'install_provider_sdk'
  | 'register_webhook'
  | 'schedule_send'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms';

export type VipDeliveryProviderIntegrationArchitectureBlockedAction =
  | 'add_api_key'
  | 'add_env'
  | 'call_provider_api'
  | 'create_delivery_log_table'
  | 'execute_campaign'
  | 'handle_provider_callback'
  | 'import_provider_client'
  | 'install_provider_sdk'
  | 'register_webhook'
  | 'resolve_raw_recipient'
  | 'schedule_send'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms'
  | 'write_delivery_log';

export type VipDeliveryProviderIntegrationArchitectureFutureComponent =
  | 'ApprovalVerifier'
  | 'ConsentVerifier'
  | 'DeliveryAuditLogger'
  | 'DeliveryProviderAdapter'
  | 'EmailProviderAdapter'
  | 'FallbackPolicy'
  | 'KakaoProviderAdapter'
  | 'RateLimitGuard'
  | 'ReadinessVerifier'
  | 'RecipientResolver'
  | 'RetryPolicy'
  | 'SecureSecretProvider'
  | 'SmsProviderAdapter'
  | 'WebhookStatusReceiver';

export type VipDeliveryProviderIntegrationArchitecturePrecondition =
  | 'delivery_execution_contract'
  | 'delivery_readiness_checklist'
  | 'marketing_consent_model'
  | 'owner_approval_gate'
  | 'provider_selection_plan';

export type VipDeliverySecretEnvArchitectureBlockedAction =
  | 'add_api_key'
  | 'add_env'
  | 'call_provider_api'
  | 'commit_env_file'
  | 'expose_secret_in_client_bundle'
  | 'import_provider_client'
  | 'install_provider_sdk'
  | 'log_secret_value'
  | 'read_real_customer_data'
  | 'register_webhook'
  | 'send_email'
  | 'send_kakao'
  | 'send_sms';

export type VipDeliverySecretEnvArchitectureControl =
  | 'emergency_revocation_plan'
  | 'environment_separation'
  | 'least_privilege_provider_account'
  | 'no_build_output_secret'
  | 'no_client_public_secret'
  | 'no_pr_comment_secret'
  | 'owner_approval_before_key_creation'
  | 'redacted_logging_policy'
  | 'secret_rotation_plan'
  | 'server_only_secret_boundary';

export type VipDeliverySecretEnvArchitectureScope = 'local' | 'preview' | 'production';

export type VipDeliverySecretEnvLinkedContract =
  | 'delivery_execution_contract'
  | 'delivery_readiness_checklist'
  | 'marketing_consent_model'
  | 'provider_integration_architecture'
  | 'provider_selection_plan';

export type VipCampaignPreparationSectionId = 'dormancy_risk' | 'raise_average_order_value' | 'return_this_week';

export interface VipCampaignPreparationPreviewCandidate {
  customerId: string;
  maskedContact: string;
  maskedDisplayName: string;
  recommendedReason: string;
}

export interface VipCampaignPreparationPreviewSection {
  approvalRequired: true;
  blockedActions: VipCampaignPreparationBlockedAction[];
  candidateCount: number;
  cautionText: string;
  deliveryEnabled: false;
  maskedCandidates: VipCampaignPreparationPreviewCandidate[];
  previewOnly: true;
  purpose: string;
  readOnlyBadge: 'read-only';
  section: VipCampaignPreparationSectionId;
  suggestedMessageDraft: string;
  title: string;
}

export interface VipCampaignPreparationPreview {
  approvalRequired: true;
  blockedActions: VipCampaignPreparationBlockedAction[];
  deliveryEnabled: false;
  previewOnly: true;
  readOnlyNotice: string;
  sections: VipCampaignPreparationPreviewSection[];
  summary: VipCustomerReadonlyReportSample['summary'] & {
    deliveryApprovalGateRequired: true;
    previewMode: 'campaign_preparation_only';
  };
}

export interface VipDeliveryApprovalGatePlan {
  approvalLogRequired: true;
  billingCostApprovalRequired: true;
  blockedActions: VipDeliveryApprovalBlockedAction[];
  cancellationPolicyRequired: true;
  deliveryExecutionEnabled: false;
  deliveryIntegrationScope: {
    email: 'future_approval_only';
    kakao: 'future_approval_only';
    sms: 'future_approval_only';
  };
  duplicateDeliveryPreventionRequired: true;
  ownerReviewRequiredBeforeIntegration: true;
  permissionReviewRequired: true;
  readOnlyPreviewRequired: true;
  recipientAccessPolicy: 'masked_preview_then_final_count_review';
  requiresFinalRecipientCountReview: true;
  requiresMarketingConsent: true;
  requiresMaskedPreviewReview: true;
  requiresOwnerApproval: true;
  rollbackPolicyRequired: true;
  storeTenancyRequired: true;
}

export interface VipDeliveryExecutionContract {
  allowedChannels: [];
  blockedActions: VipDeliveryExecutionBlockedAction[];
  deliveryExecutionEnabled: false;
  providerIntegrationEnabled: false;
  futureChannels: VipDeliveryExecutionFutureChannel[];
  requiresAuditLog: true;
  requiresCancellationPolicy: true;
  requiresCostApproval: true;
  requiresDuplicateSendPrevention: true;
  requiresFailureHandling: true;
  requiresFinalRecipientCountReview: true;
  requiresMarketingConsent: true;
  requiresMaskedPreviewReview: true;
  requiresMessageBodyReview: true;
  requiresOwnerApproval: true;
  requiresRollbackPolicy: true;
}

export interface VipDeliveryReadinessChecklist {
  blockedActions: VipDeliveryExecutionBlockedAction[];
  checklistMode: 'readiness_only';
  deliveryExecutionEnabled: false;
  providerIntegrationEnabled: false;
  readinessCheckEnabled: true;
  requiresCancellationPolicy: true;
  requiresCostApproval: true;
  requiresDuplicatePrevention: true;
  requiresFailurePolicy: true;
  requiresMarketingConsent: true;
  requiresMessageBodyReview: true;
  requiresOptOutExclusion: true;
  requiresOwnerApproval: true;
  requiresRecipientCountReview: true;
}

export interface CustomerMarketingConsentModelPlan {
  allowedDeliveryStatuses: CustomerMarketingConsentStatus[];
  blockedActions: CustomerMarketingConsentBlockedAction[];
  blockedDeliveryStatuses: CustomerMarketingConsentStatus[];
  consentModelEnabled: false;
  consentSources: CustomerMarketingConsentSource[];
  deliveryExecutionEnabled: false;
  futureTable: 'customer_marketing_consents';
  migrationRequiredBeforeExecution: true;
  productionWriteEnabled: false;
  providerIntegrationEnabled: false;
  requiresEvidence: true;
  requiresOptOutExclusion: true;
  requiresStoreScopedConsent: true;
  requiresUnknownExclusion: true;
  requiresWithdrawalOverride: true;
}

export interface VipDeliveryProviderSelectionPlan {
  allowedChannels: [];
  apiKeyRequiredNow: false;
  blockedActions: VipDeliveryProviderSelectionBlockedAction[];
  candidateChannels: VipDeliveryProviderSelectionCandidateChannel[];
  deliveryExecutionEnabled: false;
  envChangeRequiredNow: false;
  evaluationCriteria: VipDeliveryProviderSelectionCriteria[];
  providerIntegrationEnabled: false;
  providerSelectionOnly: true;
  requiresConsentModel: true;
  requiresOwnerApprovalBeforeIntegration: true;
  requiresReadinessChecklist: true;
}

export interface VipDeliveryProviderIntegrationArchitecturePlan {
  allowedRuntimeProviders: [];
  apiKeyRequiredNow: false;
  architectureOnly: true;
  blockedActions: VipDeliveryProviderIntegrationArchitectureBlockedAction[];
  deliveryExecutionEnabled: false;
  deliveryLogTableEnabled: false;
  envChangeRequiredNow: false;
  futureComponents: VipDeliveryProviderIntegrationArchitectureFutureComponent[];
  futureProviderChannels: VipDeliveryProviderSelectionCandidateChannel[];
  providerIntegrationEnabled: false;
  providerSdkRequiredNow: false;
  rawRecipientResolutionEnabled: false;
  requiredPreconditions: VipDeliveryProviderIntegrationArchitecturePrecondition[];
  webhookEnabledNow: false;
}

export interface VipDeliverySecretEnvArchitecturePlan {
  allowedSecretNames: [];
  apiKeyAdded: false;
  apiKeyRequiredNow: false;
  blockedActions: VipDeliverySecretEnvArchitectureBlockedAction[];
  deliveryExecutionEnabled: false;
  envAdded: false;
  envChangeRequiredNow: false;
  futureSecretScopes: VipDeliverySecretEnvArchitectureScope[];
  linkedContracts: VipDeliverySecretEnvLinkedContract[];
  productionWriteEnabled: false;
  providerImportEnabled: false;
  providerIntegrationEnabled: false;
  providerSdkRequiredNow: false;
  publicClientEnvAllowed: [];
  realCustomerDataReadEnabled: false;
  requiredControls: VipDeliverySecretEnvArchitectureControl[];
  requiredRuntimeEnvVars: [];
  secretEnvArchitectureOnly: true;
  webhookEnabledNow: false;
}

export const VIP_CUSTOMER_CRITERIA_DOCUMENTATION = {
  customerVipDefinition:
    'customer VIP means a store-scoped customer candidate derived from customer memory signals.',
  futureSignals: ['recent inquiries', 'reservations', 'waiting entries', 'POS LTV integration'],
  longTermSignals: ['lifetime value', 'order count', 'visit count', 'preference depth'],
  masking: ['masked name', 'masked contact', 'aggregate evidence only'],
  reportLabels: ['VIP 고객 후보', '이번 주 다시 부를 고객', '객단가 상승 가능 고객', '휴면 위험 고객', '확인 전용 리포트'],
  shortTermSignals: ['recent visit', 'recent order', 'recent customer timeline event'],
  storeTenancy: 'every report candidate must match the active store_id before scoring.',
  subscriptionVipDefinition:
    'subscription VIP means the store plan; it is never a customer VIP scoring signal.',
} as const;

const VIP_VISIT_THRESHOLD = 5;
const VIP_ORDER_THRESHOLD = 5;
const VIP_LIFETIME_VALUE_THRESHOLD = 300000;
const REVISIT_WINDOW_DAYS = 14;
const DORMANCY_RISK_DAYS = 45;
const VIP_CAMPAIGN_BLOCKED_ACTIONS: VipCampaignPreparationBlockedAction[] = [
  'send_sms',
  'send_kakao',
  'send_email',
  'update_customer',
  'execute_campaign',
];
const VIP_DELIVERY_APPROVAL_BLOCKED_ACTIONS: VipDeliveryApprovalBlockedAction[] = [
  'send_sms',
  'send_kakao',
  'send_email',
  'schedule_send',
  'execute_campaign',
];
const VIP_DELIVERY_EXECUTION_BLOCKED_ACTIONS: VipDeliveryExecutionBlockedAction[] = [
  'send_sms',
  'send_kakao',
  'send_email',
  'schedule_send',
  'execute_campaign',
  'resolve_raw_recipient',
  'write_delivery_log',
  'create_campaign_execution',
];
const VIP_DELIVERY_EXECUTION_FUTURE_CHANNELS: VipDeliveryExecutionFutureChannel[] = ['sms', 'kakao', 'email'];
const CUSTOMER_MARKETING_ALLOWED_CONSENT_STATUSES: CustomerMarketingConsentStatus[] = ['opted_in'];
const CUSTOMER_MARKETING_BLOCKED_CONSENT_STATUSES: CustomerMarketingConsentStatus[] = [
  'unknown',
  'opted_out',
  'withdrawn',
  'expired',
  'invalid',
];
const CUSTOMER_MARKETING_CONSENT_SOURCES: CustomerMarketingConsentSource[] = [
  'public_page_form',
  'reservation_form',
  'waiting_entry',
  'manual_import',
  'pos_import',
  'owner_uploaded_list',
  'kakao_channel',
  'offline_paper',
  'unknown',
];
const CUSTOMER_MARKETING_CONSENT_BLOCKED_ACTIONS: CustomerMarketingConsentBlockedAction[] = [
  'create_consent_table',
  'write_consent_record',
  'read_real_customer_consent',
  'send_sms',
  'send_kakao',
  'send_email',
  'execute_campaign',
  'resolve_raw_recipient',
];
const VIP_DELIVERY_PROVIDER_SELECTION_CANDIDATE_CHANNELS: VipDeliveryProviderSelectionCandidateChannel[] = [
  'sms',
  'kakao',
  'email',
];
const VIP_DELIVERY_PROVIDER_SELECTION_CRITERIA: VipDeliveryProviderSelectionCriteria[] = [
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
];
const VIP_DELIVERY_PROVIDER_SELECTION_BLOCKED_ACTIONS: VipDeliveryProviderSelectionBlockedAction[] = [
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
];
const VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_PRECONDITIONS: VipDeliveryProviderIntegrationArchitecturePrecondition[] = [
  'marketing_consent_model',
  'delivery_readiness_checklist',
  'owner_approval_gate',
  'delivery_execution_contract',
  'provider_selection_plan',
];
const VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_COMPONENTS: VipDeliveryProviderIntegrationArchitectureFutureComponent[] = [
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
];
const VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_BLOCKED_ACTIONS: VipDeliveryProviderIntegrationArchitectureBlockedAction[] = [
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
];
const VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_CONTROLS: VipDeliverySecretEnvArchitectureControl[] = [
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
];
const VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_BLOCKED_ACTIONS: VipDeliverySecretEnvArchitectureBlockedAction[] = [
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
  'log_secret_value',
  'read_real_customer_data',
];
const VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_SCOPES: VipDeliverySecretEnvArchitectureScope[] = [
  'local',
  'preview',
  'production',
];
const VIP_DELIVERY_SECRET_ENV_LINKED_CONTRACTS: VipDeliverySecretEnvLinkedContract[] = [
  'provider_integration_architecture',
  'provider_selection_plan',
  'delivery_execution_contract',
  'marketing_consent_model',
  'delivery_readiness_checklist',
];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function isSameStore<T extends { store_id: string }>(storeId: string, item: T) {
  return item.store_id === storeId;
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => right!.localeCompare(left!))[0];
}

function maskPlainText(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 'masked';
  }

  if (normalized.length <= 1) {
    return '*';
  }

  return `${normalized[0]}${'*'.repeat(Math.min(normalized.length - 1, 10))}`;
}

export function maskVipCustomerName(value?: string | null) {
  return maskPlainText(value || '');
}

export function maskVipCustomerContact(value?: string | null, type: 'email' | 'phone' = 'phone') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 'contact unavailable';
  }

  if (type === 'email') {
    const [localPart, domain] = normalized.toLowerCase().split('@');
    if (!localPart || !domain) {
      return 'contact unavailable';
    }

    return `${localPart[0]}***@${domain}`;
  }

  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 7) {
    return 'contact unavailable';
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function resolveMaskedContact(customer: Customer) {
  return (
    maskVipCustomerContact(customer.phone, 'phone') ||
    maskVipCustomerContact(customer.email, 'email') ||
    'contact unavailable'
  );
}

function numericField(customer: CustomerVipFieldSource, key: 'customer_value' | 'lifetime_value' | 'order_count') {
  const value = customer[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function resolveVipReasons(input: {
  customer: CustomerVipFieldSource;
  orderCount: number;
  totalOrderAmount: number;
}) {
  const reasons: VipCustomerReason[] = [];
  const tags = Array.isArray(input.customer.tags) ? input.customer.tags : [];
  const segmentValues = [input.customer.segment, input.customer.tier, ...tags]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);
  const lifetimeValue = Math.max(
    input.totalOrderAmount,
    numericField(input.customer, 'customer_value'),
    numericField(input.customer, 'lifetime_value'),
  );
  const orderCount = Math.max(input.orderCount, numericField(input.customer, 'order_count'));

  if (input.customer.vip === true || input.customer.is_vip === true) {
    reasons.push('explicit_vip_field');
  }

  if (segmentValues.includes('vip')) {
    reasons.push('segment_or_tag');
  }

  if (input.customer.visit_count >= VIP_VISIT_THRESHOLD) {
    reasons.push('visit_count_threshold');
  }

  if (orderCount >= VIP_ORDER_THRESHOLD) {
    reasons.push('order_count_threshold');
  }

  if (lifetimeValue >= VIP_LIFETIME_VALUE_THRESHOLD) {
    reasons.push('lifetime_value_threshold');
  }

  return [...new Set(reasons)];
}

function summarizePreferences(preference: CustomerPreference | undefined) {
  const tags = (preference?.preference_tags || []).map(normalizeText).filter(Boolean).slice(0, 3);
  return tags.length ? tags.join(', ') : 'preference summary unavailable';
}

function summarizeRecentEvent(event: CustomerTimelineEvent | undefined, latestOrder: Order | undefined) {
  if (event) {
    return `${event.event_type} at ${event.occurred_at}`;
  }

  if (latestOrder) {
    return `order at ${latestOrder.placed_at}`;
  }

  return 'no recent event';
}

function daysSince(value: string | undefined, referenceDate: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const reference = Date.parse(referenceDate);
  const target = Date.parse(value);
  if (!Number.isFinite(reference) || !Number.isFinite(target)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((reference - target) / 86_400_000);
}

function toReportCandidate(card: VipCustomerReadonlyCard): VipCustomerReadonlyReportCandidate {
  return {
    customerId: card.customerId,
    maskedContact: card.maskedContact,
    maskedDisplayName: card.maskedDisplayName,
    reasonSummary: card.vipReasons.join(', '),
    totalOrderAmount: card.totalOrderAmount,
    totalVisitCount: card.totalVisitCount,
  };
}

function toPreviewCandidate(candidate: VipCustomerReadonlyReportCandidate): VipCampaignPreparationPreviewCandidate {
  return {
    customerId: candidate.customerId,
    maskedContact: candidate.maskedContact,
    maskedDisplayName: candidate.maskedDisplayName,
    recommendedReason: candidate.reasonSummary,
  };
}

function resolveStoreSubscriptionPlan(
  plan?: SubscriptionPlan,
  subscriptions?: StoreSubscription[],
  storeId?: string,
) {
  if (plan) {
    return plan;
  }

  return subscriptions?.find((subscription) => subscription.store_id === storeId)?.plan;
}

export function buildVipCustomerReadonlyView(input: {
  customers: Customer[];
  orders?: Order[];
  preferences?: CustomerPreference[];
  storeId: string;
  storeSubscriptionPlan?: SubscriptionPlan;
  storeSubscriptions?: StoreSubscription[];
  timelineEvents?: CustomerTimelineEvent[];
}): VipCustomerReadonlyView {
  const customers = input.customers.filter((customer) => isSameStore(input.storeId, customer));
  const orders = (input.orders || []).filter((order) => isSameStore(input.storeId, order));
  const preferences = (input.preferences || []).filter((preference) => isSameStore(input.storeId, preference));
  const timelineEvents = (input.timelineEvents || []).filter((event) => isSameStore(input.storeId, event));
  const vipCustomers = customers
    .flatMap((customer): VipCustomerReadonlyCard[] => {
      const customerId = normalizeCustomerId(customer);
      const customerOrders = orders
        .filter((order) => order.customer_id === customerId)
        .sort((left, right) => right.placed_at.localeCompare(left.placed_at));
      const customerTimeline = timelineEvents
        .filter((event) => event.customer_id === customerId)
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
      const totalOrderAmount = customerOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const vipReasons = resolveVipReasons({
        customer: customer as CustomerVipFieldSource,
        orderCount: customerOrders.length,
        totalOrderAmount,
      });

      if (!vipReasons.length) {
        return [];
      }

      const preference = preferences.find((item) => item.customer_id === customerId);
      const lastActivityAt = latestDate([
        customer.last_visit_at,
        customerOrders[0]?.placed_at,
        customerTimeline[0]?.occurred_at,
      ]);

      const card: VipCustomerReadonlyCard = {
        allowedActions: [],
        customerId,
        expectedNextAction: 'review profile summary before any separately approved outreach',
        maskedContact: resolveMaskedContact(customer),
        maskedDisplayName: maskVipCustomerName(customer.name),
        orderCount: customerOrders.length,
        preferenceSummary: summarizePreferences(preference),
        profileSummaryText: `visits=${customer.visit_count}; orders=${customerOrders.length}; total=${totalOrderAmount}`,
        readOnly: true,
        recentEventSummary: summarizeRecentEvent(customerTimeline[0], customerOrders[0]),
        totalOrderAmount,
        totalVisitCount: customer.visit_count,
        vipReasons,
        ...(lastActivityAt ? { lastActivityAt } : {}),
      };

      return [card];
    })
    .sort((left, right) => {
      if (right.totalOrderAmount !== left.totalOrderAmount) {
        return right.totalOrderAmount - left.totalOrderAmount;
      }

      return (right.lastActivityAt || '').localeCompare(left.lastActivityAt || '');
    });

  return {
    emptyState: {
      description:
        'Customer visits, orders, reservations, inquiries, and preferences can create VIP candidates after more memory signals accumulate.',
      title: 'No VIP customer candidates yet',
    },
    readOnlyNotice:
      'This is a read-only VIP customer memory view. It does not change customer tier, edit notes, send notifications, or write production data.',
    summary: {
      storeId: input.storeId,
      storeSubscriptionPlan: resolveStoreSubscriptionPlan(
        input.storeSubscriptionPlan,
        input.storeSubscriptions,
        input.storeId,
      ),
      subscriptionPlanIsCustomerVipSource: false,
      totalCustomersReviewed: customers.length,
      vipCustomerCount: vipCustomers.length,
    },
    vipCustomers,
  };
}

export function buildVipCustomerReadonlyReportSample(input: {
  customers: Customer[];
  orders?: Order[];
  preferences?: CustomerPreference[];
  referenceDate?: string;
  storeId: string;
  storeSubscriptionPlan?: SubscriptionPlan;
  storeSubscriptions?: StoreSubscription[];
  timelineEvents?: CustomerTimelineEvent[];
}): VipCustomerReadonlyReportSample {
  const referenceDate = input.referenceDate || new Date().toISOString();
  const view = buildVipCustomerReadonlyView(input);
  const recentCandidates = view.vipCustomers
    .filter((card) => daysSince(card.lastActivityAt, referenceDate) <= REVISIT_WINDOW_DAYS)
    .map(toReportCandidate);
  const averageOrderCandidates = view.vipCustomers
    .filter((card) => card.orderCount > 0 && card.totalOrderAmount / card.orderCount >= VIP_LIFETIME_VALUE_THRESHOLD / 2)
    .map(toReportCandidate);
  const dormancyRiskCandidates = view.vipCustomers
    .filter((card) => daysSince(card.lastActivityAt, referenceDate) >= DORMANCY_RISK_DAYS)
    .map(toReportCandidate);

  return {
    allowedActions: [],
    readOnlyNotice:
      '확인 전용 리포트입니다. 발송/수정 기능은 별도 승인 후 확장하며, 이 샘플은 고객 등급이나 운영 데이터를 바꾸지 않습니다.',
    sections: [
      {
        candidates: recentCandidates,
        description: '최근 방문/주문/이벤트가 있어 이번 주 재방문 제안을 검토할 수 있는 VIP 고객 후보입니다.',
        id: 'revisit_this_week',
        title: '이번 주 다시 부를 고객 후보',
      },
      {
        candidates: averageOrderCandidates,
        description: '평균 주문 금액이 높아 구성 추천이나 프리미엄 제안을 검토할 수 있는 VIP 고객 후보입니다.',
        id: 'raise_average_order_value',
        title: '객단가 상승 가능 고객 후보',
      },
      {
        candidates: dormancyRiskCandidates,
        description: '과거 VIP 신호는 강하지만 최근 활동이 줄어 재방문 검토가 필요한 고객 후보입니다.',
        id: 'dormancy_risk',
        title: '휴면 위험 VIP 고객 후보',
      },
    ],
    summary: {
      ...view.summary,
      campaignGateRequired: true,
      reportMode: 'sample_read_only',
    },
  };
}

export function buildVipCampaignPreparationPreview(input: {
  customers: Customer[];
  orders?: Order[];
  preferences?: CustomerPreference[];
  referenceDate?: string;
  storeId: string;
  storeSubscriptionPlan?: SubscriptionPlan;
  storeSubscriptions?: StoreSubscription[];
  timelineEvents?: CustomerTimelineEvent[];
}): VipCampaignPreparationPreview {
  const report = buildVipCustomerReadonlyReportSample(input);
  const [returnThisWeek, raiseAverageOrderValue, dormancyRisk] = report.sections;
  const sections: VipCampaignPreparationPreviewSection[] = [
    {
      approvalRequired: true,
      blockedActions: VIP_CAMPAIGN_BLOCKED_ACTIONS,
      candidateCount: returnThisWeek?.candidates.length || 0,
      cautionText:
        '확인 전용입니다. 이 화면에서는 문자/카카오/이메일 발송이 실행되지 않으며 고객 등급과 메모는 변경되지 않습니다.',
      deliveryEnabled: false,
      maskedCandidates: (returnThisWeek?.candidates || []).map(toPreviewCandidate),
      previewOnly: true,
      purpose: '최근 활동이 있는 VIP 고객 후보를 이번 주 재방문 검토 대상으로 정리합니다.',
      readOnlyBadge: 'read-only',
      section: 'return_this_week',
      suggestedMessageDraft: '최근 방문해 주셔서 감사합니다. 이번 주에 다시 들르시면 선호하시는 메뉴를 먼저 준비해 두겠습니다.',
      title: '이번 주 다시 부를 고객',
    },
    {
      approvalRequired: true,
      blockedActions: VIP_CAMPAIGN_BLOCKED_ACTIONS,
      candidateCount: raiseAverageOrderValue?.candidates.length || 0,
      cautionText:
        '확인 전용입니다. 프리미엄 제안 문구는 초안이며 발송 기능은 별도 승인 후 확장합니다.',
      deliveryEnabled: false,
      maskedCandidates: (raiseAverageOrderValue?.candidates || []).map(toPreviewCandidate),
      previewOnly: true,
      purpose: '주문 금액이 높은 VIP 고객 후보에게 객단가 상승 가능 제안을 검토합니다.',
      readOnlyBadge: 'read-only',
      section: 'raise_average_order_value',
      suggestedMessageDraft: '고객님 취향에 맞춘 프리미엄 구성 추천이 준비되어 있습니다. 다음 방문 때 안내드리겠습니다.',
      title: '객단가 상승 가능 고객',
    },
    {
      approvalRequired: true,
      blockedActions: VIP_CAMPAIGN_BLOCKED_ACTIONS,
      candidateCount: dormancyRisk?.candidates.length || 0,
      cautionText:
        '확인 전용입니다. 휴면 위험 검토만 제공하며 고객 정보, 등급, 메모, 운영 데이터는 변경하지 않습니다.',
      deliveryEnabled: false,
      maskedCandidates: (dormancyRisk?.candidates || []).map(toPreviewCandidate),
      previewOnly: true,
      purpose: '과거 VIP 신호가 강하지만 최근 활동이 줄어든 고객 후보를 재방문 검토 대상으로 정리합니다.',
      readOnlyBadge: 'read-only',
      section: 'dormancy_risk',
      suggestedMessageDraft: '오랜만에 다시 모시고 싶습니다. 선호하셨던 구성 기준으로 방문 준비를 해두겠습니다.',
      title: '휴면 위험 VIP 고객',
    },
  ];

  return {
    approvalRequired: true,
    blockedActions: VIP_CAMPAIGN_BLOCKED_ACTIONS,
    deliveryEnabled: false,
    previewOnly: true,
    readOnlyNotice:
      '캠페인 준비 미리보기는 read-only / preview-only 화면입니다. 발송 기능은 별도 승인 후 확장합니다.',
    sections,
    summary: {
      ...report.summary,
      deliveryApprovalGateRequired: true,
      previewMode: 'campaign_preparation_only',
    },
  };
}

export function buildVipDeliveryApprovalGatePlan(): VipDeliveryApprovalGatePlan {
  return {
    approvalLogRequired: true,
    billingCostApprovalRequired: true,
    blockedActions: VIP_DELIVERY_APPROVAL_BLOCKED_ACTIONS,
    cancellationPolicyRequired: true,
    deliveryExecutionEnabled: false,
    deliveryIntegrationScope: {
      email: 'future_approval_only',
      kakao: 'future_approval_only',
      sms: 'future_approval_only',
    },
    duplicateDeliveryPreventionRequired: true,
    ownerReviewRequiredBeforeIntegration: true,
    permissionReviewRequired: true,
    readOnlyPreviewRequired: true,
    recipientAccessPolicy: 'masked_preview_then_final_count_review',
    requiresFinalRecipientCountReview: true,
    requiresMarketingConsent: true,
    requiresMaskedPreviewReview: true,
    requiresOwnerApproval: true,
    rollbackPolicyRequired: true,
    storeTenancyRequired: true,
  };
}

export function buildVipDeliveryExecutionContract(): VipDeliveryExecutionContract {
  return {
    allowedChannels: [],
    blockedActions: VIP_DELIVERY_EXECUTION_BLOCKED_ACTIONS,
    deliveryExecutionEnabled: false,
    futureChannels: VIP_DELIVERY_EXECUTION_FUTURE_CHANNELS,
    providerIntegrationEnabled: false,
    requiresAuditLog: true,
    requiresCancellationPolicy: true,
    requiresCostApproval: true,
    requiresDuplicateSendPrevention: true,
    requiresFailureHandling: true,
    requiresFinalRecipientCountReview: true,
    requiresMarketingConsent: true,
    requiresMaskedPreviewReview: true,
    requiresMessageBodyReview: true,
    requiresOwnerApproval: true,
    requiresRollbackPolicy: true,
  };
}

export function buildVipDeliveryReadinessChecklist(): VipDeliveryReadinessChecklist {
  return {
    blockedActions: VIP_DELIVERY_EXECUTION_BLOCKED_ACTIONS,
    checklistMode: 'readiness_only',
    deliveryExecutionEnabled: false,
    providerIntegrationEnabled: false,
    readinessCheckEnabled: true,
    requiresCancellationPolicy: true,
    requiresCostApproval: true,
    requiresDuplicatePrevention: true,
    requiresFailurePolicy: true,
    requiresMarketingConsent: true,
    requiresMessageBodyReview: true,
    requiresOptOutExclusion: true,
    requiresOwnerApproval: true,
    requiresRecipientCountReview: true,
  };
}

export function buildCustomerMarketingConsentModelPlan(): CustomerMarketingConsentModelPlan {
  return {
    allowedDeliveryStatuses: CUSTOMER_MARKETING_ALLOWED_CONSENT_STATUSES,
    blockedActions: CUSTOMER_MARKETING_CONSENT_BLOCKED_ACTIONS,
    blockedDeliveryStatuses: CUSTOMER_MARKETING_BLOCKED_CONSENT_STATUSES,
    consentModelEnabled: false,
    consentSources: CUSTOMER_MARKETING_CONSENT_SOURCES,
    deliveryExecutionEnabled: false,
    futureTable: 'customer_marketing_consents',
    migrationRequiredBeforeExecution: true,
    productionWriteEnabled: false,
    providerIntegrationEnabled: false,
    requiresEvidence: true,
    requiresOptOutExclusion: true,
    requiresStoreScopedConsent: true,
    requiresUnknownExclusion: true,
    requiresWithdrawalOverride: true,
  };
}

export function buildVipDeliveryProviderSelectionPlan(): VipDeliveryProviderSelectionPlan {
  return {
    allowedChannels: [],
    apiKeyRequiredNow: false,
    blockedActions: VIP_DELIVERY_PROVIDER_SELECTION_BLOCKED_ACTIONS,
    candidateChannels: VIP_DELIVERY_PROVIDER_SELECTION_CANDIDATE_CHANNELS,
    deliveryExecutionEnabled: false,
    envChangeRequiredNow: false,
    evaluationCriteria: VIP_DELIVERY_PROVIDER_SELECTION_CRITERIA,
    providerIntegrationEnabled: false,
    providerSelectionOnly: true,
    requiresConsentModel: true,
    requiresOwnerApprovalBeforeIntegration: true,
    requiresReadinessChecklist: true,
  };
}

export function buildVipDeliveryProviderIntegrationArchitecturePlan(): VipDeliveryProviderIntegrationArchitecturePlan {
  return {
    allowedRuntimeProviders: [],
    apiKeyRequiredNow: false,
    architectureOnly: true,
    blockedActions: VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_BLOCKED_ACTIONS,
    deliveryExecutionEnabled: false,
    deliveryLogTableEnabled: false,
    envChangeRequiredNow: false,
    futureComponents: VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_COMPONENTS,
    futureProviderChannels: VIP_DELIVERY_PROVIDER_SELECTION_CANDIDATE_CHANNELS,
    providerIntegrationEnabled: false,
    providerSdkRequiredNow: false,
    rawRecipientResolutionEnabled: false,
    requiredPreconditions: VIP_DELIVERY_PROVIDER_INTEGRATION_ARCHITECTURE_PRECONDITIONS,
    webhookEnabledNow: false,
  };
}

export function buildVipDeliverySecretEnvArchitecturePlan(): VipDeliverySecretEnvArchitecturePlan {
  return {
    allowedSecretNames: [],
    apiKeyAdded: false,
    apiKeyRequiredNow: false,
    blockedActions: VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_BLOCKED_ACTIONS,
    deliveryExecutionEnabled: false,
    envAdded: false,
    envChangeRequiredNow: false,
    futureSecretScopes: VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_SCOPES,
    linkedContracts: VIP_DELIVERY_SECRET_ENV_LINKED_CONTRACTS,
    productionWriteEnabled: false,
    providerImportEnabled: false,
    providerIntegrationEnabled: false,
    providerSdkRequiredNow: false,
    publicClientEnvAllowed: [],
    realCustomerDataReadEnabled: false,
    requiredControls: VIP_DELIVERY_SECRET_ENV_ARCHITECTURE_CONTROLS,
    requiredRuntimeEnvVars: [],
    secretEnvArchitectureOnly: true,
    webhookEnabledNow: false,
  };
}
