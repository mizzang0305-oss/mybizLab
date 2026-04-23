import { ALL_FEATURES, type FeatureKey, type StoreFeature } from '../../types/models.js';

export function createStoreFeatureId(storeId: string, featureKey: FeatureKey) {
  return `store_feature_${storeId}_${featureKey}`;
}

export function buildStoreFeatures(storeId: string, selectedFeatures: FeatureKey[]): StoreFeature[] {
  const enabledSet = new Set(selectedFeatures);

  return ALL_FEATURES.map((featureKey) => ({
    id: createStoreFeatureId(storeId, featureKey),
    store_id: storeId,
    feature_key: featureKey,
    enabled: enabledSet.has(featureKey),
  }));
}
