import { ALL_FEATURES, type FeatureKey, type StoreFeature } from '@/shared/types/models';
import { createId } from '@/shared/lib/ids';

export function buildStoreFeatures(storeId: string, selectedFeatures: FeatureKey[]): StoreFeature[] {
  const enabledSet = new Set(selectedFeatures);

  return ALL_FEATURES.map((featureKey) => ({
    id: createId('store_feature'),
    store_id: storeId,
    feature_key: featureKey,
    enabled: enabledSet.has(featureKey),
  }));
}
