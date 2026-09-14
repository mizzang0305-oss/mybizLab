/**
 * Fail-closed runtime gates for the Service OS persistence surface.
 *
 * These values are intentionally independent from build-time environment
 * variables. A future production release must bind them to separately
 * certified server-side configuration after the foundation and activation
 * migrations have each passed their own Owner Gate.
 */
export interface ServiceOsActivationEvidence {
  foundationSchemaCertified: boolean;
  browserWriteMigrationCertified: boolean;
  confirmationAdapterCertified: boolean;
  paymentAdapterCertified: boolean;
  publicationAdapterCertified: boolean;
}

export interface ServiceOsActivationState {
  schemaInstalled: boolean;
  liveWriteEnabled: boolean;
  confirmationEnabled: boolean;
  paymentEnabled: boolean;
  publicationEnabled: boolean;
}

export const DEFAULT_SERVICE_OS_ACTIVATION: Readonly<ServiceOsActivationState> = Object.freeze({
  schemaInstalled: false,
  liveWriteEnabled: false,
  confirmationEnabled: false,
  paymentEnabled: false,
  publicationEnabled: false,
});

export function resolveServiceOsActivation(
  evidence: ServiceOsActivationEvidence,
): ServiceOsActivationState {
  const schemaInstalled = evidence.foundationSchemaCertified;
  const liveWriteEnabled = schemaInstalled && evidence.browserWriteMigrationCertified;

  return {
    schemaInstalled,
    liveWriteEnabled,
    confirmationEnabled: liveWriteEnabled && evidence.confirmationAdapterCertified,
    paymentEnabled: liveWriteEnabled && evidence.paymentAdapterCertified,
    publicationEnabled: liveWriteEnabled && evidence.publicationAdapterCertified,
  };
}
