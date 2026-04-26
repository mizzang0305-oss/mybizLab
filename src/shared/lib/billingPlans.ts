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
} as const;

export type BillingPlanCode = keyof typeof BILLING_PLAN_DETAILS;

export const SUBSCRIPTION_TEST_PRODUCT = {
  amount: 100,
  code: 'subscription_test_100',
  orderName: '\uad6c\ub3c5 \uacb0\uc81c \ud14c\uc2a4\ud2b8 100\uc6d0',
  plan: 'pro',
  planName: '\uad6c\ub3c5 \uacb0\uc81c \ud14c\uc2a4\ud2b8',
} as const;

export type BillingCheckoutProductCode = typeof SUBSCRIPTION_TEST_PRODUCT.code;

export const BILLING_PLAN_CODES = Object.keys(BILLING_PLAN_DETAILS) as BillingPlanCode[];

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return typeof value === 'string' && BILLING_PLAN_CODES.includes(value as BillingPlanCode);
}

export function isBillingCheckoutProductCode(value: unknown): value is BillingCheckoutProductCode {
  return value === SUBSCRIPTION_TEST_PRODUCT.code;
}

export function getBillingPlan(plan: BillingPlanCode) {
  return BILLING_PLAN_DETAILS[plan];
}

export function getBillingCheckoutProduct(code: BillingCheckoutProductCode) {
  if (code === SUBSCRIPTION_TEST_PRODUCT.code) {
    return SUBSCRIPTION_TEST_PRODUCT;
  }

  return null;
}
