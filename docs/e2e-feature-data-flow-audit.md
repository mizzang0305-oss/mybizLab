# E2E Feature Data Flow Audit

This document defines the July 2026 E2E feature and data-flow audit only.

It does not run production database writes, create stores, create leads, import customer data, read real customer data, resolve raw recipients, charge payments, add provider integrations, publish social posts, publish blog posts, add API keys, add OAuth clients, add env vars, or register webhooks.

## Purpose

MyBiz is a memory-based revenue engine SaaS.

This audit checks whether the July pilot can explain the full customer-memory revenue path without opening unsafe execution paths. The launch mode is `pilot_readonly_revenue_engine`.

## current openable features

- public domain/pricing pages
- VIP Customer Memory read-only
- VIP criteria/report sample
- customer memory card preview
- campaign preparation preview
- delivery approval gate
- delivery execution contract
- delivery readiness checklist
- marketing consent model
- provider selection plan
- provider integration architecture
- secret/env architecture
- raw recipient resolution boundary
- delivery audit log plan
- July launch checklist
- pricing/plan lock
- pilot onboarding checklist
- pilot sales kit
- pilot consultation record template

## not open yet

- production DB write
- real store/customer/order creation
- real customer data import
- raw phone/email resolution
- recipient export
- actual SMS/Kakao/Email delivery
- provider integration
- API key/env registration
- delivery log table/write
- payment/billing/subscription automation
- webhook/callback
- YouTube publishing
- Instagram publishing
- Threads publishing
- blog auto-publishing
- cross-channel analytics attribution

## core data flow audit

| Flow | Status | Audit note |
| --- | --- | --- |
| public page -> inquiry/lead | plan_only | Public lead/inquiry capability exists elsewhere, but this audit does not create or write a lead. |
| store -> customer memory profile | plan_only | Customer memory profile is documented and read-only; no real store/customer reads are performed here. |
| customer -> preference/order/context | plan_only | Preference/order/context signals are represented as existing model concepts only. |
| customer memory -> VIP candidate | ready | VIP candidate read-only logic is already covered by docs/tests. |
| VIP candidate -> campaign preview | ready | Campaign preview remains masked and preview-only. |
| campaign preview -> approval gate | ready | Delivery approval gate is documented as a separate owner gate. |
| approval gate -> readiness checklist | ready | Readiness checklist remains pure/read-only. |
| readiness -> raw recipient boundary | plan_only | Raw recipient boundary is documented, not executed. |
| raw recipient boundary -> delivery audit log plan | plan_only | Audit log remains plan-only; no table or write path exists. |
| sales kit -> consultation record | plan_only | Consultation record is a template, not a persistence feature. |
| consultation record -> pilot conversion grade | plan_only | Conversion grade is a manual planning label only. |
| pricing plan -> Growth offer | ready | Growth 99,000 KRW is the primary July pilot offer. |
| pilot onboarding -> Growth 99,000 proposal | ready | Onboarding materials connect the pilot to Growth-first positioning. |
| demo rehearsal -> Go/No-Go gate | plan_only | The synthetic-only 3-minute rehearsal feeds the July launch gate without reading real customer data. |

## blocked risk flows

These flows must stay blocked before separate owner approval, legal/privacy review, and implementation gates.

| Risk flow | Required status | Reason |
| --- | --- | --- |
| customer memory -> raw phone/email | blocked | Raw recipient access requires a future consent, tenancy, and audit design. |
| raw recipient -> provider send | blocked | Provider send requires provider selection, keys, consent, logs, and owner approval. |
| campaign preview -> actual delivery | blocked | Preview must not execute delivery. |
| consultation record -> production lead write | blocked | Consultation template must not create leads. |
| pricing plan -> payment charge | blocked | Pricing plan is not payment automation. |
| pilot onboarding -> store creation | blocked | Pilot onboarding is not store provisioning. |
| SNS content -> automatic outbound publishing | blocked | Social/blog publishing needs channel approval and manual review first. |

## analytics gap

- cross-channel attribution is missing
- source-to-lead UTM policy is not locked
- blog/social campaign naming is not locked
- owner review evidence for social posts is not defined
- no read-only dashboard connects channel activity to pilot conversion grades yet

## launch risk

- channel integrations are not implemented and should remain manual for July
- blog publishing status needs verification before any automation plan
- public pages and pricing are smoke-tested, but channel attribution is not production-ready
- payment, provider delivery, raw recipient resolution, and production writes remain blocked
- post-pilot integrations require separate approval phrases in `docs/post-pilot-integration-approval-matrix.md`
- PR #148 remains outside this audit

## Code Contract

The pure code contract is `buildE2eFeatureDataFlowAndChannelAuditPlan()`.

Required values:

- `auditPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `productionSideEffectsEnabled: false`
- `dataFlowExecutionEnabled: false`
- `socialPublishingEnabled: false`
- `blogAutoPublishingEnabled: false`
- `paymentAutomationEnabled: false`
- `providerIntegrationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `realCustomerDataReadEnabled: false`
- `requiredAuditAreas: ["feature_matrix", "data_flow_map", "blocked_flow_map", "channel_integration_readiness", "youtube_readiness", "instagram_readiness", "threads_readiness", "blog_readiness", "analytics_gap", "launch_risk"]`
- `blockedActions: ["call_youtube_api", "call_instagram_api", "call_threads_api", "publish_blog_post", "add_oauth_client", "add_api_key", "add_env", "upload_video", "publish_social_post", "write_customer_data", "create_store", "create_lead", "charge_payment", "send_sms", "send_kakao", "send_email", "resolve_raw_recipient"]`

This contract is pure and in-memory. It must not call social APIs, publish content, write data, create stores or leads, charge payments, send messages, resolve raw recipients, add keys, add env vars, add OAuth clients, or register webhooks.

## Related Documents

- `docs/july-launch-go-no-go-gate.md`
- `docs/post-pilot-integration-approval-matrix.md`
- `docs/demo-rehearsal-script.md`
- `docs/demo-synthetic-scenario.md`
- `docs/channel-integration-readiness-audit.md`
- `docs/july-launch-checklist.md`
- `docs/pilot-consultation-record-template.md`
- `docs/pilot-sales-kit.md`
- `docs/vip-customer-delivery-provider-integration-architecture.md`
