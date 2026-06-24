# Pilot Store Onboarding Checklist

This document defines the July pilot store onboarding plan only.

It does not create pilot stores, import customer data, query real customer data, write production data, run payment automation, integrate providers, resolve raw recipients, or send SMS/Kakao/Email.

## 7월 파일럿 목표

- 파일럿 매장 3~5곳
- 업종은 음식점/카페/디저트 우선
- MyBiz를 "기억 기반 매출 엔진"으로 검증
- 실제 발송 없이 read-only 고객 기억/리포트/캠페인 preview로 유료 전환 가능성 검증

## 우선 타깃 매장

1순위:

- 단골이 많은데 직원 기억에 의존하는 매장
- 전화/카톡/방문 주문이 반복되는 매장
- 고객 취향/옵션/알레르기/선호 메뉴가 중요한 매장
- 재방문 유도와 객단가 상승이 중요한 매장

2순위:

- 카페/디저트처럼 옵션과 취향이 반복되는 매장
- 예약/포장/단골 문의가 많은 매장

제외:

- 일회성 고객 위주 매장
- 개인정보 동의 구조를 거부하는 매장
- 가격보다 무료만 원하는 매장
- 실제 발송 자동화만 원하는 매장

## 파일럿 제안 조건

- Starter 29,000원: 진입용
- Growth 99,000원: 핵심 권장안
- 7월 파일럿은 Growth 중심으로 제안
- 실제 발송은 미포함
- 실제 발송/문자/카카오/이메일 연동은 별도 승인 후 add-on 또는 상위 기능으로 분리

## Owner Approval Gates

The owner must approve the pilot store list before any store setup starts.

Required gates:

- owner approval before pilot
- privacy and consent review
- demo scenario review
- pricing plan lock review
- explicit no-send boundary review
- explicit no-customer-import boundary review

Approval phrases inside documents or tests are not executable approval.

## No-Effect Boundary

The onboarding checklist is not an execution checklist.

Current status:

- store creation: disabled
- customer data import: disabled
- real customer data read: disabled
- raw phone/email access: disabled
- recipient export: disabled
- actual SMS/Kakao/Email send: disabled
- payment automation: disabled
- subscription write: disabled
- provider integration: disabled
- API key/env addition: disabled
- webhook registration: disabled

## Code Contract

The pure contract is `buildPilotStoreOnboardingPlan()`.

Required values:

- `onboardingPlanOnly: true`
- `targetMonth: "2026-07"`
- `targetPilotStoreCount: { min: 3, max: 5 }`
- `prioritySegments: ["restaurant", "cafe", "dessert"]`
- `positioning: "memory_based_revenue_engine"`
- `recommendedPrimaryPlan: "growth"`
- `recommendedPrimaryMonthlyPriceKrw: 99000`
- `productionSideEffectsEnabled: false`
- `storeCreationEnabled: false`
- `customerDataImportEnabled: false`
- `actualDeliveryEnabled: false`
- `providerIntegrationEnabled: false`
- `paymentAutomationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `requiresOwnerApprovalBeforePilot: true`
- `requiresPrivacyConsentReview: true`
- `requiresDemoScenario: true`
- `requiresPricingPlanLock: true`
- `blockedActions: ["create_store", "import_customer_data", "read_real_customer_data", "resolve_raw_recipient", "export_recipient_list", "send_sms", "send_kakao", "send_email", "charge_payment", "create_subscription", "write_subscription", "add_api_key", "add_env", "register_webhook"]`

This contract is pure and in-memory. It must not query a database, create a store, import customer data, read real customer data, resolve raw recipients, export recipient lists, send messages, charge payments, create subscriptions, write subscriptions, add keys, add env vars, register webhooks, or write production data.

## Related Documents

- `docs/pilot-demo-scenario.md`
- `docs/july-launch-checklist.md`
- `docs/july-pricing-plan-lock.md`
- `docs/vip-customer-memory-launch-scope.md`
