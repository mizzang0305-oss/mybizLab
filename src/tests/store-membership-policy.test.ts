import { describe, expect, it } from 'vitest';

import {
  isProductionAuthoritativePrincipal,
  requireStoreMembershipForDashboard,
  resolveDashboardStoreMembership,
  resolvePaidEntitlement,
} from '@/domain/mybiz/storeMembership';
import type { StoreMember, StoreSubscription } from '@/shared/types/models';

const ownerMembership: StoreMember = {
  id: 'member_store_a_owner',
  created_at: '2026-06-08T00:00:00.000Z',
  profile_id: 'profile_owner',
  role: 'owner',
  store_id: 'store_a',
};

const activeProSubscription: StoreSubscription = {
  id: 'subscription_store_a',
  created_at: '2026-06-08T00:00:00.000Z',
  current_period_starts_at: '2026-06-08T00:00:00.000Z',
  current_period_ends_at: '2026-07-08T00:00:00.000Z',
  plan: 'pro',
  status: 'active',
  store_id: 'store_a',
  updated_at: '2026-06-08T00:00:00.000Z',
};

describe('store membership policy', () => {
  it('requires a matching store_members row before dashboard access', () => {
    const denied = resolveDashboardStoreMembership({
      memberships: [ownerMembership],
      principal: {
        profileId: 'profile_owner',
        provider: 'supabase',
      },
      storeId: 'store_b',
    });

    expect(denied).toMatchObject({
      canAccessDashboard: false,
      matchedMembership: null,
      reason: 'store_member_required',
      storeId: 'store_b',
    });
    expect(() =>
      requireStoreMembershipForDashboard({
        memberships: [ownerMembership],
        principal: {
          profileId: 'profile_owner',
          provider: 'supabase',
        },
        storeId: 'store_b',
      }),
    ).toThrow('STORE_MEMBERSHIP_REQUIRED');
  });

  it('allows owner, manager, or staff only when the profile belongs to that store', () => {
    expect(
      resolveDashboardStoreMembership({
        memberships: [ownerMembership],
        principal: {
          profileId: 'profile_owner',
          provider: 'supabase',
        },
        storeId: 'store_a',
      }),
    ).toMatchObject({
      canAccessDashboard: true,
      matchedMembership: ownerMembership,
      reason: 'store_member_role_allowed',
    });
  });

  it('does not treat demo/local sessions as production truth', () => {
    expect(
      isProductionAuthoritativePrincipal({
        profileId: 'profile_owner',
        provider: 'demo',
      }),
    ).toBe(false);
    expect(
      isProductionAuthoritativePrincipal({
        profileId: 'profile_owner',
        provider: 'supabase',
      }),
    ).toBe(true);
  });

  it('requires canonical store_subscriptions before paid entitlement decisions', () => {
    expect(
      resolvePaidEntitlement({
        requiredPlans: ['pro', 'vip'],
        storeId: 'store_a',
        subscription: null,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'store_subscription_required',
    });

    expect(
      resolvePaidEntitlement({
        requiredPlans: ['pro', 'vip'],
        storeId: 'store_a',
        subscription: activeProSubscription,
      }),
    ).toMatchObject({
      allowed: true,
      reason: 'store_subscription_plan_checked',
    });
  });
});
