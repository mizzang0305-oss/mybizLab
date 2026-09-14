import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BRAND_SITE_TIERS,
  CUSTOMER_MEMORY_DISPOSITION,
  LEGACY_RESTAURANT_CAPABILITIES,
  MYBIZ_CANONICAL_FLOW,
  MYBIZ_PRODUCT_IDENTITY,
  PUBLIC_V1_VERTICALS,
  SERVICE_OS_CORE_MODULES,
  SERVICE_OS_ONBOARDING_QUESTIONS,
  SUBSCRIPTION_PLAN_CODES,
  isCommercialTaxonomySeparated,
  recommendOptionalModules,
} from '@/domain/mybiz/productTruth';
import { DEFAULT_MEDICAL_VERTICAL_ENABLED, isPublicationEligible } from '@/domain/mybiz/serviceOs';
import { HOMEPAGE_COPY, HOMEPAGE_FAQ } from '@/pages/mybiz-field/content/homepageCopy';
import { adminNavigation, legacyRestaurantNavigation, resolveAdminNavigation } from '@/shared/lib/moduleCatalog';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('MyBiz R3 canonical product truth', () => {
  it('locks the product identity and complete canonical flow', () => {
    expect(MYBIZ_PRODUCT_IDENTITY).toEqual({
      company: 'MyBizLab',
      product: 'MyBiz',
      category: 'Business Service OS',
      corePromise: '작업부터 다음 고객까지.',
    });
    expect(MYBIZ_CANONICAL_FLOW).toEqual([
      'Customer / Lead', 'Job', 'optional Contract', 'Work', 'Evidence', 'Customer Confirmation',
      'Payment Tracking', 'Evidence Package', 'Channel-specific Consent', 'Merchant Approval',
      'Brand / Content Asset', 'Customer Memory', 'Next Customer',
    ]);
  });

  it('keeps public V1 and regulated defaults narrow', () => {
    expect(PUBLIC_V1_VERTICALS).toEqual(['cleaning', 'hair', 'installation']);
    expect(DEFAULT_MEDICAL_VERTICAL_ENABLED).toBe(false);
  });

  it('keeps customer memory as one capability instead of the whole product', () => {
    expect(CUSTOMER_MEMORY_DISPOSITION).toBe('cross-cutting revenue capability');
    expect(SERVICE_OS_CORE_MODULES).toContain('customers');
    expect(MYBIZ_PRODUCT_IDENTITY.category).not.toMatch(/Customer Memory/i);
  });

  it('separates SaaS plans from brand-site tiers', () => {
    expect(SUBSCRIPTION_PLAN_CODES).toEqual(['FREE', 'PRO', 'VIP']);
    expect(BRAND_SITE_TIERS).toEqual(['Basic', 'Brand', 'Growth']);
    expect(isCommercialTaxonomySeparated()).toBe(true);
  });

  it('builds optional module recommendations without a payment or activation side effect', () => {
    const recommended = recommendOptionalModules({
      evidence: true,
      confirmation: true,
      contract: true,
      payment: true,
      schedule: false,
      website: true,
      portfolio: true,
      content: false,
      customerMemory: true,
    });

    expect(SERVICE_OS_ONBOARDING_QUESTIONS).toHaveLength(11);
    expect(recommended).toEqual(['media vault', 'contract', 'payment tracking', 'brand website', 'customer memory']);
    expect(recommended).not.toContain('subscription checkout');
  });

  it('removes restaurant capabilities from default navigation but preserves their routes', () => {
    const defaultRoutes = adminNavigation.map((item) => item.route);
    const legacyRoutes = legacyRestaurantNavigation.map((item) => item.route);

    for (const route of ['/dashboard/orders', '/dashboard/waiting', '/dashboard/table-order']) {
      expect(defaultRoutes).not.toContain(route);
      expect(legacyRoutes).toContain(route);
      expect(resolveAdminNavigation(route)?.route).toBe(route);
    }
    expect(LEGACY_RESTAURANT_CAPABILITIES).toContain('kitchen');
  });

  it('keeps confirmation, payment, consent, approval and publication independent', () => {
    const job = {
      id: 'job-1', storeId: 'store-1', vertical: 'cleaning' as const, serviceName: '청소',
      requiresContract: false, contractState: 'NOT_REQUIRED' as const,
      state: 'CUSTOMER_CONFIRMED' as const, evidenceRevision: 1, paymentState: 'PAYMENT_PENDING' as const,
    };
    const confirmation = {
      id: 'confirmation-1', storeId: 'store-1', jobId: 'job-1', evidenceRevision: 1,
      outcome: 'confirmed' as const, confirmedAt: '2026-09-14T00:00:00Z',
    };

    expect(job.paymentState).not.toBe('PAYMENT_PAID');
    expect(isPublicationEligible({ channel: 'website', job, confirmation, merchantApproved: true })).toBe(false);
  });

  it('keeps the approved homepage visual contract while clarifying the product category', () => {
    expect(HOMEPAGE_COPY.hero.eyebrow).toBe('MYBIZ BUSINESS SERVICE OS');
    expect(HOMEPAGE_COPY.hero.body).toContain('결과와 완료 증빙이 중요한 서비스업');
    expect(HOMEPAGE_COPY.hero.demoNotice).toContain('실제 결제·서명·외부 게시는 실행되지 않습니다.');
    expect(HOMEPAGE_FAQ.flat().join(' ')).toContain('작업 확인과 대금 결제는 별도 상태');
  });

  it('keeps the Stage 2 SQL draft out of active migrations', () => {
    const draft = 'supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql';
    const active = 'supabase/migrations/20260913083614_mybiz_stage2_service_os.sql';

    expect(existsSync(resolve(process.cwd(), draft))).toBe(true);
    expect(existsSync(resolve(process.cwd(), active))).toBe(false);
  });

  it('anchors repository documentation to the canonical product truth', () => {
    expect(read('README.md')).toContain('MyBiz — Business Service OS');
    expect(read('README.md')).toContain('Legacy Restaurant Vertical Demo Scenarios');
    expect(read('docs/mybiz/CANONICAL_PRODUCT.md')).toContain('작업부터 다음 고객까지.');
    expect(read('docs/mybiz/COMMERCIAL_TAXONOMY.md')).toContain('subscription_plan != brand_site_tier');
  });
});
