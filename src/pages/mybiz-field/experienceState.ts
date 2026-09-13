export interface DemoApprovalState {
  confirmed: boolean;
  consented: boolean;
  merchantApproved: boolean;
}

export const HERO_CAN_MUTATE_DEMO_APPROVAL_STATE = false;

export function createDemoApprovalState(): DemoApprovalState {
  return { confirmed: false, consented: false, merchantApproved: false };
}

export function isPortfolioEligible(state: DemoApprovalState) {
  return state.confirmed && state.consented && state.merchantApproved;
}
