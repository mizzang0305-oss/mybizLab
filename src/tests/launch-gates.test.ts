import { afterEach, describe, expect, it } from 'vitest';

import {
  LAUNCH_GATES,
  clearLaunchGateOverridesForTest,
  getLaunchGateStatus,
  getPilotBetaLaunchGateSummary,
  isLaunchGateEnabled,
  setLaunchGateOverridesForTest,
} from '@/shared/lib/launchGates';

describe('launch gates', () => {
  afterEach(() => {
    clearLaunchGateOverridesForTest();
  });

  it('keeps pilot beta acquisition surfaces on by default', () => {
    expect(LAUNCH_GATES).toMatchObject({
      launchBetaEnabled: true,
      onboardingDiagnosisEnabled: true,
      ownerReviewedLeadCaptureEnabled: true,
      publicPricingEnabled: true,
    });

    expect(getPilotBetaLaunchGateSummary()).toMatchObject({
      mode: 'pilot_beta',
    });
    expect(getPilotBetaLaunchGateSummary().enabled).toEqual(
      expect.arrayContaining([
        'launchBetaEnabled',
        'customerMemorySpineEnabled',
        'publicPricingEnabled',
        'onboardingDiagnosisEnabled',
        'ownerReviewedLeadCaptureEnabled',
      ]),
    );
  });

  it('keeps paid launch and risky mutations approval-gated by default', () => {
    expect(getPilotBetaLaunchGateSummary().gated).toEqual(
      expect.arrayContaining([
        'billingCheckoutEnabled',
        'billingWebhookEnabled',
        'broadDbWriteEnabled',
        'customerNotificationEnabled',
        'eSignEnabled',
        'externalAiEnabled',
        'leadCapturePersistenceEnabled',
        'liveLeadWriteEnabled',
        'liveCustomerMemoryWriteEnabled',
        'oauthPublishEnabled',
        'posPaymentEnabled',
        'selfServePaidLaunchEnabled',
        'uploadMutationEnabled',
      ]),
    );

    expect(getLaunchGateStatus('billingCheckoutEnabled')).toMatchObject({
      enabled: false,
      status: 'approval_required',
    });
  });

  it('supports explicit test overrides without changing the default map', () => {
    setLaunchGateOverridesForTest({
      billingCheckoutEnabled: true,
    });

    expect(isLaunchGateEnabled('billingCheckoutEnabled')).toBe(true);
    expect(LAUNCH_GATES.billingCheckoutEnabled).toBe(false);
  });
});
