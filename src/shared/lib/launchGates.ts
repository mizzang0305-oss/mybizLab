export type LaunchGateKey =
  | 'launchBetaEnabled'
  | 'publicPricingEnabled'
  | 'onboardingDiagnosisEnabled'
  | 'ownerReviewedLeadCaptureEnabled'
  | 'selfServePaidLaunchEnabled'
  | 'billingCheckoutEnabled'
  | 'billingWebhookEnabled'
  | 'customerNotificationEnabled'
  | 'eSignEnabled'
  | 'posPaymentEnabled'
  | 'oauthPublishEnabled'
  | 'uploadMutationEnabled'
  | 'externalAiEnabled'
  | 'broadDbWriteEnabled'
  | 'aiTraceEnabled'
  | 'liveAiTraceWriteEnabled'
  | 'customerMemorySpineEnabled'
  | 'liveCustomerMemoryWriteEnabled'
  | 'leadCapturePersistenceEnabled'
  | 'liveLeadWriteEnabled';

export type LaunchGateStatus = 'launch_on' | 'approval_required';

export interface LaunchGateDecision {
  enabled: boolean;
  key: LaunchGateKey;
  message: string;
  status: LaunchGateStatus;
}

export const LAUNCH_GATES = {
  launchBetaEnabled: true,
  publicPricingEnabled: true,
  onboardingDiagnosisEnabled: true,
  ownerReviewedLeadCaptureEnabled: true,
  selfServePaidLaunchEnabled: false,
  billingCheckoutEnabled: false,
  billingWebhookEnabled: false,
  customerNotificationEnabled: false,
  eSignEnabled: false,
  posPaymentEnabled: false,
  oauthPublishEnabled: false,
  uploadMutationEnabled: false,
  externalAiEnabled: false,
  broadDbWriteEnabled: false,
  aiTraceEnabled: true,
  liveAiTraceWriteEnabled: false,
  customerMemorySpineEnabled: true,
  liveCustomerMemoryWriteEnabled: false,
  leadCapturePersistenceEnabled: false,
  liveLeadWriteEnabled: false,
} as const satisfies Record<LaunchGateKey, boolean>;

export const LAUNCH_GATE_MESSAGES = {
  launchBetaEnabled: '파일럿 베타 공개 범위가 켜져 있습니다.',
  publicPricingEnabled: 'FREE/PRO/VIP 가격 안내는 공개됩니다.',
  onboardingDiagnosisEnabled: '무료 온보딩 진단은 공개됩니다.',
  ownerReviewedLeadCaptureEnabled: '리드 수집은 담당자 검토 후 처리됩니다.',
  selfServePaidLaunchEnabled: '셀프서브 유료 런칭은 아직 승인 대기 상태입니다.',
  billingCheckoutEnabled: '결제는 파일럿 상담 후 적용됩니다. 무료 진단 후 매장 상황에 맞게 세팅해드립니다.',
  billingWebhookEnabled: '결제 웹훅 처리는 별도 승인 전까지 비활성 상태입니다.',
  customerNotificationEnabled: '고객 자동 알림은 동의와 담당자 승인 전까지 비활성 상태입니다.',
  eSignEnabled: '전자계약/e-sign은 별도 승인 전까지 비활성 상태입니다.',
  posPaymentEnabled: 'POS/table-order 실결제는 별도 승인 전까지 비활성 상태입니다.',
  oauthPublishEnabled: 'OAuth/SNS 발행은 별도 승인 전까지 비활성 상태입니다.',
  uploadMutationEnabled: '업로드/삭제 변경은 별도 승인 전까지 비활성 상태입니다.',
  externalAiEnabled: '실제 AI/STT 외부 호출은 비용/개인정보 가드 전까지 비활성 상태입니다.',
  broadDbWriteEnabled: '광범위한 production DB write는 RLS/store membership 검증 전까지 비활성 상태입니다.',
  aiTraceEnabled: 'AI trace prompt/eval interface is enabled for local/mock and read-only quality review flows.',
  liveAiTraceWriteEnabled: 'Live AI trace persistence remains disabled until provider, schema, and privacy approvals are complete.',
  customerMemorySpineEnabled: 'Customer memory intake spine is enabled for local/mock and read-only planning flows.',
  liveCustomerMemoryWriteEnabled: 'Live customer memory writes remain disabled until owner approval enables the reviewed Supabase path.',
  leadCapturePersistenceEnabled: 'Live lead capture persistence remains approval-gated until migration and RLS are approved.',
  liveLeadWriteEnabled: 'Live lead writes remain disabled until owner approval enables the reviewed Supabase path.',
} as const satisfies Record<LaunchGateKey, string>;

let launchGateOverridesForTest: Partial<Record<LaunchGateKey, boolean>> = {};

function readLaunchGateValue(key: LaunchGateKey) {
  return launchGateOverridesForTest[key] ?? LAUNCH_GATES[key];
}

export function isLaunchGateEnabled(key: LaunchGateKey) {
  return readLaunchGateValue(key);
}

export function getLaunchGateStatus(key: LaunchGateKey): LaunchGateDecision {
  const enabled = isLaunchGateEnabled(key);

  return {
    enabled,
    key,
    message: LAUNCH_GATE_MESSAGES[key],
    status: enabled ? 'launch_on' : 'approval_required',
  };
}

export function getPilotBetaLaunchGateSummary() {
  const entries = (Object.keys(LAUNCH_GATES) as LaunchGateKey[]).map(getLaunchGateStatus);

  return {
    enabled: entries.filter((entry) => entry.enabled).map((entry) => entry.key),
    gated: entries.filter((entry) => !entry.enabled).map((entry) => entry.key),
    mode: isLaunchGateEnabled('launchBetaEnabled') && !isLaunchGateEnabled('selfServePaidLaunchEnabled')
      ? 'pilot_beta'
      : 'custom',
  };
}

export function setLaunchGateOverridesForTest(overrides: Partial<Record<LaunchGateKey, boolean>>) {
  launchGateOverridesForTest = {
    ...launchGateOverridesForTest,
    ...overrides,
  };
}

export function clearLaunchGateOverridesForTest() {
  launchGateOverridesForTest = {};
}
