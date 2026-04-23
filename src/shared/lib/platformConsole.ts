import { featureDefinitions } from './moduleCatalog.js';
import type {
  AdminUserRole,
  AdminUserStatus,
  FeatureKey,
  InvitationStatus,
  PaymentMethodStatus,
  SetupPaymentStatus,
  StoreRequestStatus,
  StoreVisibility,
  SubscriptionPlan,
  SubscriptionStatus,
  SystemStatusState,
} from '../types/models.js';

const featureMap = new Map(featureDefinitions.map((feature) => [feature.key, feature]));

export const STORE_REQUEST_STATUS_LABELS: Record<StoreRequestStatus, string> = {
  draft: '초안',
  submitted: '제출됨',
  reviewing: '검토중',
  approved: '승인됨',
  rejected: '반려됨',
};

export const STORE_VISIBILITY_LABELS: Record<StoreVisibility, string> = {
  public: '공개중',
  private: '비공개',
};

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'FREE',
  pro: 'PRO',
  vip: 'VIP',
};

export const SETUP_STATUS_LABELS: Record<SetupPaymentStatus, string> = {
  setup_pending: '세팅비 결제 대기',
  setup_paid: '세팅비 결제 완료',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  subscription_pending: '구독 준비',
  subscription_active: '구독 활성',
  subscription_past_due: '결제 실패',
  subscription_cancelled: '구독 해지',
  refund_requested: '환불 요청',
};

export const PAYMENT_METHOD_STATUS_LABELS: Record<PaymentMethodStatus, string> = {
  ready: '결제 수단 정상',
  action_required: '결제 수단 확인 필요',
  missing: '결제 수단 미등록',
};

export const ADMIN_ROLE_LABELS: Record<AdminUserRole, string> = {
  platform_owner: '플랫폼 소유자',
  platform_admin: '플랫폼 운영자',
  store_owner: '스토어 대표',
  store_manager: '스토어 매니저',
};

export const ADMIN_USER_STATUS_LABELS: Record<AdminUserStatus, string> = {
  active: '활성',
  pending: '대기',
  inactive: '비활성',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  sent: '초대 발송',
  scheduled: '초대 예정',
  accepted: '수락됨',
  none: '미발송',
};

export const SYSTEM_STATUS_LABELS: Record<SystemStatusState, string> = {
  active: '정상',
  ready: '준비 완료',
  warning: '주의',
  pending: '대기',
  error: '오류',
};

export function getFeatureLabel(featureKey: FeatureKey) {
  return featureMap.get(featureKey)?.label || featureKey;
}

export function getFeatureRoute(featureKey: FeatureKey) {
  return featureMap.get(featureKey)?.route || '/dashboard';
}

export function getFeatureDescription(featureKey: FeatureKey) {
  return featureMap.get(featureKey)?.description || '';
}

export function summarizeFeatureLabels(featureKeys: FeatureKey[], limit = 3) {
  const labels = featureKeys.map(getFeatureLabel);
  if (labels.length <= limit) {
    return labels.join(', ');
  }

  return `${labels.slice(0, limit).join(', ')} 외 ${labels.length - limit}개`;
}
