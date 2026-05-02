import { describe, expect, it } from 'vitest';

import {
  autoFixPlatformText,
  filterPublicPricingPlans,
  scanPlatformContentQuality,
  sanitizePublicPlatformText,
} from '@/shared/lib/platformAdminConfig';

describe('platform public content quality', () => {
  it('flags developer-facing wording as a critical public content issue', () => {
    const result = scanPlatformContentQuality([
      {
        entityId: 'hero',
        entityType: 'platform_homepage_sections',
        fields: {
          body: '실결제는 PortOne으로 이어지며 webhook과 API 상태를 확인합니다.',
          title: '고객 기억 기반 매출 시스템',
        },
        publicExposure: true,
      },
    ]);

    expect(result.score).toBeLessThan(100);
    expect(result.criticalCount).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.severity === 'critical' && issue.keyword === 'webhook')).toBe(true);
  });

  it('auto-fixes known internal payment wording into customer-safe copy', () => {
    expect(autoFixPlatformText('결제 완료 후 store_subscriptions 반영으로 권한이 확정됩니다.')).toBe(
      '결제 완료 후 이용 권한이 안전하게 적용됩니다.',
    );
    expect(autoFixPlatformText('PortOne checkout, redirect, verify, webhook 상태 확인용입니다.')).toBe(
      '안전한 결제 흐름을 확인하는 관리자 전용 항목입니다.',
    );
  });

  it('sanitizes unsafe public text instead of returning internal copy', () => {
    expect(sanitizePublicPlatformText('환경이 준비되지 않은 경우 API fallback을 사용합니다.', '안전한 기본 안내')).toBe(
      '안전한 기본 안내',
    );
  });

  it('keeps pricing output customer-safe while preserving plan truth', () => {
    const plans = filterPublicPricingPlans([
      {
        billing_cycle: 'month',
        bullet_items: ['고객 관리', 'webhook 상태 확인'],
        cta_action: 'checkout',
        cta_label: 'PRO 시작',
        currency: 'KRW',
        display_name: 'PRO',
        footnote: '결제 완료 후 store_subscriptions 반영으로 권한이 확정됩니다.',
        is_recommended: true,
        is_visible: true,
        plan_code: 'pro',
        price_amount: 79000,
        short_description: '고객 기억 운영 플랜',
        sort_order: 20,
        status: 'published',
      },
    ]);

    const pro = plans.find((plan) => plan.plan_code === 'pro');
    expect(pro).toMatchObject({
      plan_code: 'pro',
      price_amount: 79000,
    });
    expect(JSON.stringify(pro)).not.toMatch(/store_subscriptions|webhook|API/i);
  });
});
