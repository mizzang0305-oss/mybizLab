import { describe, expect, it } from 'vitest';

import { buildDiagnosisResult } from '@/shared/lib/onboardingFlow';

describe('diagnosis recommendation logic', () => {
  it('recommends brand inquiry mode for brand-first stores', () => {
    const result = buildDiagnosisResult({
      availableData: ['reservation_inquiry'],
      currentConcern: 'brand_identity',
      desiredOutcome: 'brand_growth',
      industryType: 'service',
      region: '서울 강남',
      storeModeSelection: 'not_sure',
    });

    expect(result.recommendedStoreMode).toBe('brand_inquiry_first');
    expect(result.recommendedDataMode).toBe('survey_only');
    expect(result.recommendedModules).toContain('brand_management');
    expect(result.recommendedQuestions).toHaveLength(4);
  });

  it('keeps order-first mode for menu analysis with order data', () => {
    const result = buildDiagnosisResult({
      availableData: ['order_data'],
      currentConcern: 'menu_response',
      desiredOutcome: 'menu_analysis',
      industryType: 'cafe',
      region: '서울 성수동',
      storeModeSelection: 'order_first',
    });

    expect(result.recommendedStoreMode).toBe('order_first');
    expect(result.recommendedDataMode).toBe('order_only');
    expect(result.recommendedModules).toEqual(expect.arrayContaining(['order_management', 'table_order']));
  });

  it('recommends hybrid mode when survey and order signals should be combined', () => {
    const result = buildDiagnosisResult({
      availableData: ['order_data', 'manual_notes'],
      currentConcern: 'service_quality',
      desiredOutcome: 'service_improvement',
      industryType: 'restaurant',
      region: '서울 잠실',
      storeModeSelection: 'not_sure',
    });

    expect(result.recommendedStoreMode).toBe('hybrid');
    expect(result.recommendedDataMode).toBe('order_survey_manual');
    expect(result.recommendedModules).toEqual(expect.arrayContaining(['surveys', 'customer_management']));
  });
});

