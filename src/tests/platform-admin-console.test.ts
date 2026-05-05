import { describe, expect, it } from 'vitest';

import {
  buildPaymentTestReadiness,
  handlePlatformAdminRequest,
  handlePlatformPublicRequest,
  normalizePlatformAdminMemberRole,
} from '@/server/platformAdminApi';
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

const PORTONE_ENV_KEYS = [
  'PORTONE_API_SECRET',
  'PORTONE_V2_API_SECRET',
  'PORTONE_WEBHOOK_SECRET',
  'PORTONE_STORE_ID',
  'NEXT_PUBLIC_PORTONE_STORE_ID',
  'VITE_PORTONE_STORE_ID',
  'PORTONE_CHANNEL_KEY',
  'NEXT_PUBLIC_PORTONE_CHANNEL_KEY',
  'VITE_PORTONE_CHANNEL_KEY',
  'PORTONE_SANDBOX_CONFIRMED',
  'PORTONE_ENV',
  'NEXT_PUBLIC_PORTONE_ENV',
  'VITE_PORTONE_ENV',
] as const;

function withPortOneEnv(values: Partial<Record<(typeof PORTONE_ENV_KEYS)[number], string>>) {
  const previous = new Map<string, string | undefined>();

  PORTONE_ENV_KEYS.forEach((key) => {
    previous.set(key, process.env[key]);
    delete process.env[key];
  });

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      process.env[key] = value;
    }
  });

  return () => {
    PORTONE_ENV_KEYS.forEach((key) => {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
}

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

  it('serves the 100 KRW test product only when the explicit query flag is present', async () => {
    const response = await handlePlatformPublicRequest(
      new Request('https://mybiz.ai.kr/api/public/platform/pricing?resource=platform-pricing&testPayment=1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.testProducts).toHaveLength(1);
    expect(payload.data.testProducts[0]).toMatchObject({
      amount: 100,
      product_code: PAYMENT_TEST_PRODUCT_CODE,
    });
    expect(payload.data.testProducts[0]).not.toHaveProperty('grants_entitlement');
    expect(JSON.stringify(payload.data.testProducts[0])).not.toMatch(/webhook|store_subscriptions|entitlement|grants_entitlement/i);
  });

  it('serves customer-safe public page fallback content', async () => {
    const response = await handlePlatformPublicRequest(
      new Request('https://mybiz.ai.kr/api/public/platform/page?resource=page&slug=trust'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.page.slug).toBe('trust');
    expect(payload.data.page.title).toContain('고객 기억');
    expect(JSON.stringify(payload.data)).not.toMatch(/webhook|store_subscriptions|dummy|TODO|internal/i);
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

  it('accepts only platform_owner and platform_admin as platform admin roles', () => {
    expect(normalizePlatformAdminMemberRole('platform_owner')).toBe('platform_owner');
    expect(normalizePlatformAdminMemberRole('platform_admin')).toBe('platform_admin');
    expect(normalizePlatformAdminMemberRole('platform_viewer')).toBeNull();
    expect(normalizePlatformAdminMemberRole('owner')).toBeNull();
    expect(normalizePlatformAdminMemberRole('unexpected')).toBeNull();
  });

  it('reports safe Korean payment-test readiness when PortOne configuration is missing', () => {
    const restore = withPortOneEnv({});
    try {
      const readiness = buildPaymentTestReadiness();

      expect(readiness).toMatchObject({
        code: 'PORTONE_NOT_CONFIGURED',
        isReady: false,
        message: 'PortOne 테스트 결제 설정이 아직 완료되지 않았습니다.',
      });
      expect(readiness.missing).toEqual(
        expect.arrayContaining(['PORTONE_API_SECRET', 'PORTONE_WEBHOOK_SECRET', 'PORTONE_STORE_ID', 'PORTONE_CHANNEL_KEY']),
      );
      expect(JSON.stringify(readiness)).not.toMatch(/FUNCTION_INVOCATION_FAILED|secret_|sk_/i);
    } finally {
      restore();
    }
  });

  it('keeps 100 KRW checkout disabled until sandbox/test channel is explicitly confirmed', () => {
    const restore = withPortOneEnv({
      PORTONE_API_SECRET: 'configured',
      PORTONE_WEBHOOK_SECRET: 'configured',
      PORTONE_STORE_ID: 'configured',
      PORTONE_CHANNEL_KEY: 'configured',
    });
    try {
      const readiness = buildPaymentTestReadiness();

      expect(readiness).toMatchObject({
        code: 'PORTONE_SANDBOX_NOT_CONFIRMED',
        isReady: false,
        missing: ['PORTONE_SANDBOX_CONFIRMED'],
      });
    } finally {
      restore();
    }
  });
});
