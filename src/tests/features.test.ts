import { buildStoreFeatures } from '@/shared/lib/domain/features';

describe('feature selection mapping', () => {
  it('creates store_features rows with enabled flags', () => {
    const features = buildStoreFeatures('store_1', ['ai_manager', 'table_order']);
    const aiFeature = features.find((feature) => feature.feature_key === 'ai_manager');
    const reportFeature = features.find((feature) => feature.feature_key === 'ai_business_report');

    expect(features).toHaveLength(12);
    expect(aiFeature?.enabled).toBe(true);
    expect(reportFeature?.enabled).toBe(false);
  });
});
