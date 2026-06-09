import type { StoreMember, StoreSubscription } from '@/shared/types/models';

export type StoreMembershipRole = StoreMember['role'];

export interface StoreMembershipPrincipal {
  provider?: 'demo' | 'supabase';
  profileId?: string | null;
}

export interface StoreMembershipDecision {
  canAccessDashboard: boolean;
  matchedMembership: StoreMember | null;
  reason: 'store_member_required' | 'store_member_role_allowed';
  storeId: string;
}

const DASHBOARD_ROLES = new Set<StoreMembershipRole>(['owner', 'manager', 'staff']);

function normalizeStoreId(storeId?: string | null) {
  return storeId?.trim() || '';
}

function normalizeProfileId(profileId?: string | null) {
  return profileId?.trim() || '';
}

export function findStoreMembership(input: {
  memberships: StoreMember[];
  profileId?: string | null;
  storeId?: string | null;
}) {
  const storeId = normalizeStoreId(input.storeId);
  const profileId = normalizeProfileId(input.profileId);

  if (!storeId || !profileId) {
    return null;
  }

  return (
    input.memberships.find(
      (membership) =>
        membership.store_id === storeId &&
        membership.profile_id === profileId &&
        DASHBOARD_ROLES.has(membership.role),
    ) || null
  );
}

export function resolveDashboardStoreMembership(input: {
  memberships: StoreMember[];
  principal: StoreMembershipPrincipal;
  storeId?: string | null;
}): StoreMembershipDecision {
  const storeId = normalizeStoreId(input.storeId);
  const matchedMembership = findStoreMembership({
    memberships: input.memberships,
    profileId: input.principal.profileId,
    storeId,
  });

  return {
    canAccessDashboard: Boolean(matchedMembership),
    matchedMembership,
    reason: matchedMembership ? 'store_member_role_allowed' : 'store_member_required',
    storeId,
  };
}

export function isProductionAuthoritativePrincipal(principal: StoreMembershipPrincipal) {
  return principal.provider === 'supabase' && Boolean(normalizeProfileId(principal.profileId));
}

export function requireStoreMembershipForDashboard(input: {
  memberships: StoreMember[];
  principal: StoreMembershipPrincipal;
  storeId?: string | null;
}) {
  const decision = resolveDashboardStoreMembership(input);

  if (!decision.canAccessDashboard) {
    throw new Error('STORE_MEMBERSHIP_REQUIRED');
  }

  return decision.matchedMembership;
}

export function resolvePaidEntitlement(input: {
  requiredPlans: StoreSubscription['plan'][];
  storeId?: string | null;
  subscription?: StoreSubscription | null;
}) {
  const storeId = normalizeStoreId(input.storeId);
  const subscription = input.subscription || null;
  const hasCanonicalStoreSubscription =
    Boolean(storeId) &&
    Boolean(subscription) &&
    subscription?.store_id === storeId &&
    subscription.status === 'active';

  return {
    allowed:
      hasCanonicalStoreSubscription &&
      input.requiredPlans.includes(subscription?.plan as StoreSubscription['plan']),
    reason: hasCanonicalStoreSubscription ? 'store_subscription_plan_checked' : 'store_subscription_required',
    storeId,
    subscription,
  };
}
