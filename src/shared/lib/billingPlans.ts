export const BILLING_PLAN_DETAILS = {
  starter: {
    amount: 29000,
    code: 'starter',
    orderName: 'Starter 월 구독',
    planName: 'Starter',
  },
  pro: {
    amount: 79000,
    code: 'pro',
    orderName: 'Pro 월 구독',
    planName: 'Pro',
  },
  business: {
    amount: 149000,
    code: 'business',
    orderName: 'Business 월 구독',
    planName: 'Business',
  },
} as const;

export type BillingPlanCode = keyof typeof BILLING_PLAN_DETAILS;

export const BILLING_PLAN_CODES = Object.keys(BILLING_PLAN_DETAILS) as BillingPlanCode[];

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return typeof value === 'string' && BILLING_PLAN_CODES.includes(value as BillingPlanCode);
}

export function getBillingPlan(plan: BillingPlanCode) {
  return BILLING_PLAN_DETAILS[plan];
}
