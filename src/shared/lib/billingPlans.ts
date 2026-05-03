import {
  FALLBACK_PRICING_PLANS,
  PAYMENT_TEST_100_PRODUCT,
  PAYMENT_TEST_PRODUCT_CODE,
  type PlatformBillingProduct,
  type PlatformPlanCode,
} from './platformAdminConfig';

export const BILLING_PLAN_DETAILS = {
  free: {
    amount: 0,
    code: 'free',
    orderName: 'FREE 플랜',
    planName: 'FREE',
  },
  pro: {
    amount: 79000,
    code: 'pro',
    orderName: 'PRO 구독',
    planName: 'PRO',
  },
  vip: {
    amount: 149000,
    code: 'vip',
    orderName: 'VIP 구독',
    planName: 'VIP',
  },
} as const satisfies Record<
  PlatformPlanCode,
  {
    amount: number;
    code: PlatformPlanCode;
    orderName: string;
    planName: string;
  }
>;

export type BillingPlanCode = keyof typeof BILLING_PLAN_DETAILS;

export const BILLING_PAYMENT_TEST_PRODUCT = {
  amount: PAYMENT_TEST_100_PRODUCT.amount,
  code: PAYMENT_TEST_PRODUCT_CODE,
  grantsEntitlement: false,
  isTestProduct: true,
  orderName: PAYMENT_TEST_100_PRODUCT.order_name || PAYMENT_TEST_100_PRODUCT.product_name,
  plan: null,
  planName: PAYMENT_TEST_100_PRODUCT.product_name,
  productType: 'test',
  purpose: 'payment_test',
} as const;

export const SUBSCRIPTION_TEST_PRODUCT = BILLING_PAYMENT_TEST_PRODUCT;

export type BillingCheckoutProductCode = typeof BILLING_PAYMENT_TEST_PRODUCT.code;

export const BILLING_PLAN_CODES = Object.keys(BILLING_PLAN_DETAILS) as BillingPlanCode[];

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return typeof value === 'string' && BILLING_PLAN_CODES.includes(value as BillingPlanCode);
}

export function isBillingCheckoutProductCode(value: unknown): value is BillingCheckoutProductCode {
  return value === BILLING_PAYMENT_TEST_PRODUCT.code;
}

export function getBillingPlan(plan: BillingPlanCode) {
  return BILLING_PLAN_DETAILS[plan];
}

export function getBillingCheckoutProduct(code: BillingCheckoutProductCode) {
  if (code === BILLING_PAYMENT_TEST_PRODUCT.code) {
    return BILLING_PAYMENT_TEST_PRODUCT;
  }

  return null;
}

export function getFallbackPricingPlan(plan: BillingPlanCode) {
  return FALLBACK_PRICING_PLANS.find((item) => item.plan_code === plan) || null;
}

export function toBillingCheckoutProduct(product: PlatformBillingProduct) {
  return {
    amount: product.amount,
    code: product.product_code,
    grantsEntitlement: product.grants_entitlement,
    isTestProduct: product.is_test_product,
    orderName: product.order_name || product.product_name,
    plan: product.linked_plan_code || null,
    planName: product.product_name,
    productType: product.product_type,
    purpose: typeof product.metadata?.purpose === 'string' ? product.metadata.purpose : null,
  };
}
