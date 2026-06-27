# July Launch Go/No-Go Gate

This document defines the final July 2026 pilot launch Go/No-Go gate.

It is plan-only and read-only. It does not execute launch, create stores, create leads, import customer data, read real customer data, send SMS/Kakao/Email, charge payments, create subscriptions, resolve raw recipients, add API keys, add environment variables, register webhooks, or write production data.

## Goal

Decide whether MyBiz can start the July pilot conversation as a memory-based revenue engine SaaS without opening risky execution paths.

The gate protects four boundaries:

- production site health is verified
- Growth 99,000 KRW is clearly explained
- privacy, consent, and read-only pilot boundaries are clear
- actual delivery, payment automation, customer import, and raw recipient resolution remain disabled

## Required GO criteria

All criteria must be true before the owner can approve a July pilot start:

- `production_public_pages_ok`: `/` returns a healthy public response
- `pricing_page_ok`: `/pricing` returns a healthy public response
- `robots_txt_ok`: `/robots.txt` returns text/plain with `User-agent` and `Sitemap`
- `sitemap_xml_ok`: `/sitemap.xml` returns XML
- `growth_price_locked`: Growth 99,000 KRW is the primary pilot offer
- `sales_kit_ready`: the pilot sales kit is ready
- `outreach_manual_kit_ready`: the manual outreach kit is ready
- `consultation_record_ready`: the consultation record template is ready
- `demo_rehearsal_ready`: the 3-minute synthetic-only demo rehearsal is ready
- `blog_manual_content_plan_ready`: blog/content work remains manual and approved separately

## Required NO-GO criteria

Any one of these blocks launch:

- `unclear_price_pitch`: the owner cannot explain Growth 99,000 KRW clearly
- `delivery_misleading_claim`: the demo implies actual sending is already available
- `privacy_boundary_unclear`: privacy, consent, or raw-contact boundaries are unclear
- `growth_pitch_weak`: the Growth plan value is not connected to customer memory, revisit, or average order value
- `demo_rehearsal_not_ready`: the representative cannot complete the 3-minute explanation
- `production_smoke_failed`: public site, pricing, robots, or sitemap smoke failed

## Manual pilot-store selection

The July pilot still requires manual owner selection of 3 to 5 candidate stores.

This gate does not create a store, create a lead, import customer data, or save a consultation record. The owner can use external notes to decide whether a candidate is HOT, WARM, COLD, or NO_FIT.

## Safety boundary

These remain closed until a later explicit approval gate:

- actual SMS/Kakao/Email delivery
- production DB write
- customer data import
- real customer data read
- raw phone/email resolution
- recipient export
- payment automation
- billing webhook
- subscription write
- provider integration
- API key or env registration
- webhook or callback endpoint registration

## Code contract

The pure contract is `buildJulyLaunchGoNoGoGatePlan()`.

Required values:

- `goNoGoPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `launchExecutionEnabled: false`
- `requiresOwnerGoApproval: true`
- `requiresProductionSmoke: true`
- `requiresRobotsTxtValid: true`
- `requiresSitemapValid: true`
- `requiresManualPilotStoreSelection: true`
- `requiresDemoRehearsal: true`
- `requiresPricingLock: true`
- `requiresPrivacyBoundary: true`
- `requiresNoActualDelivery: true`
- `requiresNoPaymentAutomation: true`
- `requiresNoRawRecipientResolution: true`

Blocked actions:

- `execute_launch`
- `create_store`
- `create_lead`
- `import_customer_data`
- `read_real_customer_data`
- `send_sms`
- `send_kakao`
- `send_email`
- `charge_payment`
- `create_subscription`
- `write_subscription`
- `resolve_raw_recipient`
- `add_api_key`
- `add_env`
- `register_webhook`

## Owner decision

Only a later explicit owner approval can move this from plan-only to launch execution.

The required future decision must be separate from this PR and must state the exact launch scope, pilot stores, privacy boundary, and rollback plan.

## Related Documents

- `docs/july-launch-checklist.md`
- `docs/demo-rehearsal-script.md`
- `docs/demo-synthetic-scenario.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-outreach-manual-kit.md`
- `docs/pilot-consultation-record-template.md`
- `docs/pilot-pre-contract-checklist.md`
- `docs/e2e-feature-data-flow-audit.md`
