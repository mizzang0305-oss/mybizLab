import { getCanonicalMyBizRepository } from '../repositories/index.js';
import type { CanonicalMyBizRepository } from '../repositories/contracts.js';
import type { SubscriptionPlan } from '../../types/models.js';

export type StoreEntitlement =
  | 'public_store_page'
  | 'public_inquiry'
  | 'customer_memory'
  | 'reservations'
  | 'waiting_board';

const PLAN_ENTITLEMENTS = {
  free: {
    customer_memory: false,
    public_inquiry: false,
    public_store_page: true,
    reservations: false,
    waiting_board: false,
  },
  pro: {
    customer_memory: true,
    public_inquiry: true,
    public_store_page: true,
    reservations: true,
    waiting_board: true,
  },
  vip: {
    customer_memory: true,
    public_inquiry: true,
    public_store_page: true,
    reservations: true,
    waiting_board: true,
  },
} as const;

type StoreEntitlementsOptions = {
  repository?: CanonicalMyBizRepository;
};

function normalizeStorePlan(value: unknown): SubscriptionPlan {
  if (value === 'free' || value === 'pro' || value === 'vip') {
    return value;
  }

  if (value === 'starter') {
    return 'free';
  }

  if (value === 'business' || value === 'enterprise') {
    return 'vip';
  }

  return 'free';
}

const ENTITLEMENT_ERROR_MESSAGE: Record<StoreEntitlement, string> = {
  customer_memory: '고객 메모리 기능은 PRO 또는 VIP 플랜에서 사용할 수 있습니다.',
  public_inquiry: '문의 접수는 PRO 또는 VIP 플랜에서 사용할 수 있습니다.',
  public_store_page: '공개 스토어 페이지를 사용할 수 없는 플랜입니다.',
  reservations: '예약 기능은 PRO 또는 VIP 플랜에서 사용할 수 있습니다.',
  waiting_board: '웨이팅 보드는 PRO 또는 VIP 플랜에서 사용할 수 있습니다.',
};

export async function getStorePlan(storeId: string, options?: StoreEntitlementsOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const subscription = await repository.getStoreSubscription(storeId);
  return normalizeStorePlan(subscription?.plan);
}

export async function getStoreEntitlements(storeId: string, options?: StoreEntitlementsOptions) {
  const plan = await getStorePlan(storeId, options);
  return {
    entitlements: PLAN_ENTITLEMENTS[plan],
    plan,
  };
}

export async function hasStoreEntitlement(storeId: string, entitlement: StoreEntitlement, options?: StoreEntitlementsOptions) {
  const { entitlements } = await getStoreEntitlements(storeId, options);
  return entitlements[entitlement];
}

export async function assertStoreEntitlement(
  storeId: string,
  entitlement: StoreEntitlement,
  fallbackMessage?: string,
  options?: StoreEntitlementsOptions,
) {
  const enabled = await hasStoreEntitlement(storeId, entitlement, options);
  if (enabled) {
    return;
  }

  throw new Error(fallbackMessage || ENTITLEMENT_ERROR_MESSAGE[entitlement]);
}
