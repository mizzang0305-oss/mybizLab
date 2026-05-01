import { describe, expect, it } from 'vitest';

import { handlePlatformAdminRequest, handlePlatformPublicRequest } from '@/server/platformAdminApi';
import { resolveServerCatalogItem } from '@/server/platformCatalog';
import {
  FALLBACK_HOMEPAGE_SECTIONS,
  FALLBACK_PRICING_PLANS,
  FALLBACK_BILLING_PRODUCTS,
  PAYMENT_TEST_PRODUCT_CODE,
  filterPublicHomepageSections,
  filterPublicPricingPlans,
  shouldExposeBillingProduct,
} from '@/shared/lib/platformAdminConfig';

describe('platform admin console foundations', () => {
  it('keeps public homepage sections published-only and sorted', () => {
    const sections = filterPublicHomepageSections([
      {
        ...FALLBACK_HOMEPAGE_SECTIONS[0],
        section_key: 'draft',
        sort_order: 1,
        status: 'draft',
      },
      {
        ...FALLBACK_HOMEPAGE_SECTIONS[0],
        section_key: 'visible-second',
        sort_order: 20,
      },
      {
        ...FALLBACK_HOMEPAGE_SECTIONS[1],
        section_key: 'visible-first',
        sort_order: 10,
      },
    ]);

    expect(sections.map((section) => section.section_key)).toEqual(['visible-first', 'visible-second']);
  });

  it('keeps pricing plan truth limited to free/pro/vip', () => {
    const plans = filterPublicPricingPlans(FALLBACK_PRICING_PLANS);

    expect(plans.map((plan) => plan.plan_code)).toEqual(['free', 'pro', 'vip']);
    expect(plans.find((plan) => plan.plan_code === 'free')).toMatchObject({
      cta_action: 'onboarding',
      cta_href: '/onboarding?plan=free',
      price_amount: 0,
    });
  });

  it('hides the 100 KRW payment test product by default and exposes it only with the query flag', () => {
    const product = FALLBACK_BILLING_PRODUCTS[0];

    expect(product.product_code).toBe(PAYMENT_TEST_PRODUCT_CODE);
    expect(product.grants_entitlement).toBe(false);
    expect(shouldExposeBillingProduct({ product, searchParams: new URLSearchParams() })).toBe(false);
    expect(shouldExposeBillingProduct({ product, searchParams: new URLSearchParams('testPayment=1') })).toBe(true);
  });

  it('resolves payment_test_100 server-side as 100 KRW without entitlement grants', async () => {
    const item = await resolveServerCatalogItem({ productCode: PAYMENT_TEST_PRODUCT_CODE });

    expect(item).toMatchObject({
      amount: 100,
      currency: 'KRW',
      grantsEntitlement: false,
      productCode: PAYMENT_TEST_PRODUCT_CODE,
      productType: 'test',
      purpose: 'payment_test',
    });
  });

  it('rejects paid checkout catalog resolution for FREE', async () => {
    await expect(resolveServerCatalogItem({ plan: 'free' })).rejects.toThrow(/FREE/);
  });

  it('serves public pricing fallback without leaking the test product by default', async () => {
    const response = await handlePlatformPublicRequest(
      new Request('https://mybiz.ai.kr/api/public/platform/pricing?resource=platform-pricing'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.plans.map((plan: { plan_code: string }) => plan.plan_code)).toEqual(['free', 'pro', 'vip']);
    expect(payload.data.testProducts).toEqual([]);
  });

  it('requires server-validated platform admin auth for admin APIs', async () => {
    const response = await handlePlatformAdminRequest(
      new Request('https://mybiz.ai.kr/api/admin/platform/session?resource=session'),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      code: 'PLATFORM_ADMIN_ERROR',
      ok: false,
    });
  });
});
