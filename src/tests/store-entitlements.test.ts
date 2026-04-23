import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { getStoreEntitlements, getStorePlan } from '@/shared/lib/services/storeEntitlementsService';

describe('store entitlement resolution', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('uses store_subscriptions as the only plan authority', async () => {
    updateDatabase((database) => {
      const store = database.stores.find((entry) => entry.id === 'store_golden_coffee');
      if (store) {
        store.plan = 'vip';
        store.subscription_plan = 'vip';
      }

      database.store_subscriptions = database.store_subscriptions.filter(
        (subscription) => subscription.store_id !== 'store_golden_coffee',
      );
    });

    const snapshot = await getStoreEntitlements('store_golden_coffee');
    const plan = await getStorePlan('store_golden_coffee');

    expect(plan).toBe('free');
    expect(snapshot.degraded).toBe(true);
    expect(snapshot.warningCode).toBe('canonical_row_missing');
  });

  it('prefers the canonical subscription row even when store fields drift', async () => {
    updateDatabase((database) => {
      const store = database.stores.find((entry) => entry.id === 'store_mint_bbq');
      if (store) {
        store.plan = 'vip';
        store.subscription_plan = 'vip';
      }

      const subscription = database.store_subscriptions.find((entry) => entry.store_id === 'store_mint_bbq');
      if (subscription) {
        subscription.plan = 'pro';
        subscription.status = 'active';
      }
    });

    const entitlementSnapshot = await getStoreEntitlements('store_mint_bbq');

    expect(entitlementSnapshot.degraded).toBe(false);
    expect(entitlementSnapshot.plan).toBe('pro');
    expect(entitlementSnapshot.entitlements.customer_memory).toBe(true);
    expect(entitlementSnapshot.entitlements.public_store_page).toBe(true);
  });
});
