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

export const BILLING_PLAN_CODES = Object.keys(BILLING_PLAN_DETAILS) as BillingPlanCode[];

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return typeof value === 'string' && BILLING_PLAN_CODES.includes(value as BillingPlanCode);
}

export function getBillingPlan(plan: BillingPlanCode) {
  return BILLING_PLAN_DETAILS[plan];
}
