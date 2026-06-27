# Pilot Follow-up Script

This document defines the July 2026 pilot follow-up script only.

It is not a contract confirmation, lead creation workflow, store onboarding workflow, payment step, outbound automation, provider integration, or customer data intake. It is manual copy for deciding whether a candidate store is suitable for the read-only Growth 99,000 pilot.

## Purpose

The follow-up confirms whether the store is suitable for the Growth 99,000 pilot and classifies the conversation as HOT/WARM/COLD/NO_FIT.

The owner should explain that the pilot is read-only, actual delivery is not open, and no real customer data is reviewed during outreach.

## Follow-up Questions

- How do you remember regular customers now?
- Does preference information disappear when staff changes?
- Do repeat orders or preferred options affect revenue?
- Do you need revisit or average order value lift?
- Do you understand the read-only pilot with no real sends?
- How strong is the price resistance to Growth 99,000?
- Can you provide pilot feedback or an interview after review?

## Follow-up Comment

Based on the conversation, this store appears to have customer memory signals worth reviewing. The next step is still read-only: we show the concept, confirm whether customer memory and VIP candidate views are useful, and then decide if Growth 99,000 is the right pilot plan.

If the store is not ready, keep the relationship warm and do not push payment, provider setup, customer data import, or message delivery.

## Conversion Grade Filter

- HOT: clear repeat-customer pattern, strong preference memory need, understands read-only scope, accepts Growth 99,000, can give feedback.
- WARM: interested but needs more explanation on privacy, workflow, or pricing.
- COLD: wants free use only or asks mainly for immediate automation.
- NO_FIT: no repeat-customer pattern, rejects privacy boundary, or cannot support pilot feedback.

## Next Actions

- `propose_growth`
- `propose_starter`
- `schedule_follow_up`
- `mark_not_fit`

## No-Effect Boundary

The follow-up script is manual copy only.

- outbound automation: disabled
- sales SMS/Kakao/Email: disabled
- lead creation: disabled
- store creation: disabled
- customer data import: disabled
- real customer data read: disabled
- payment automation: disabled
- actual delivery: disabled
- provider integration: disabled
- raw recipient resolution: disabled
- API key/env addition: disabled
- webhook registration: disabled

## Code Contract

The pure contract is `buildPilotOutreachManualKitPlan()`.

The contract keeps `manualCopyOnly: true`, `outboundAutomationEnabled: false`, `sendSalesSmsEnabled: false`, `sendSalesKakaoEnabled: false`, `sendSalesEmailEnabled: false`, `leadCreationEnabled: false`, `storeCreationEnabled: false`, `customerDataImportEnabled: false`, `realCustomerDataReadEnabled: false`, `paymentAutomationEnabled: false`, `actualDeliveryEnabled: false`, `providerIntegrationEnabled: false`, and `rawRecipientResolutionEnabled: false`.

## Related Documents

- `docs/pilot-outreach-manual-kit.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-consultation-record-template.md`
