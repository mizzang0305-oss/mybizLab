# Pilot Sales Kit

This document defines the July 2026 pilot sales kit only.

It does not send outbound sales messages, create stores, import customer data, read real customer data, charge payments, create subscriptions, integrate SMS/Kakao/Email providers, resolve raw recipients, add API keys, add env vars, register webhooks, or write production data.

## Purpose

The sales kit helps the owner explain MyBiz as a memory-based revenue engine SaaS for 3 to 5 July pilot stores.

The kit supports a read-only pilot conversation:

- show why customer memory matters
- explain the revenue path through revisit and average order value
- position Growth 99,000 KRW as the main pilot offer
- explain privacy and no-send boundaries before any operational work
- collect owner feedback for the next approval gate

## 3분 설명 스크립트

MyBiz는 주문량이 많은 단순 CRM이 아닙니다.
사장님 매장의 단골 고객을 기억하고, 다음 주문과 재방문 준비를 도와주는 기억 기반 매출 엔진입니다.

지금 대부분 매장은 단골 정보를 직원 머릿속에 의존합니다.
누가 어떤 메뉴를 좋아하는지, 어떤 옵션을 싫어하는지, 언제 다시 올 가능성이 높은지가 시스템에 남지 않습니다.

MyBiz는 고객 기억 카드, VIP 고객 후보, 주문/취향/방문 맥락, 캠페인 준비 미리보기를 통해
사장님이 "누구에게 무엇을 제안해야 하는지"를 볼 수 있게 만듭니다.

7월 파일럿은 실제 문자 발송 없이 read-only로 시작합니다.
먼저 매장 데이터를 안전하게 정리하고, 매출 기회가 보이는지 확인하는 단계입니다.

권장 플랜은 Growth 월 99,000원입니다.

## 30초 한 줄 제안

사장님 매장의 단골 기억을 시스템에 쌓아 재주문과 객단가를 높이는 AI 매출 엔진을 7월 파일럿으로 먼저 보여드리겠습니다.

## 가격 제안 멘트

Starter 29,000원도 진입은 가능합니다.
하지만 이번 파일럿의 핵심 가치는 VIP 고객 기억과 캠페인 준비 미리보기이기 때문에 Growth 99,000원을 기준으로 제안드립니다.
실제 발송은 아직 포함하지 않고, 먼저 "누구에게 무엇을 제안할지"가 보이는지 검증하는 구조입니다.

## Required Assets

- three_minute_pitch
- thirty_second_pitch
- pricing_pitch
- objection_handling
- pre_contract_checklist

## Pre-Contract Checklist

- 업종이 음식점, 카페, 디저트 중 하나인가
- 단골 또는 반복 주문이 있는가
- 고객 취향, 옵션, 선호 메뉴가 중요한가
- 개인정보와 마케팅 동의 구조를 받을 수 있는가
- 실제 발송 없는 read-only 파일럿을 이해하는가
- Growth 99,000원 기준 제안에 동의 가능성이 있는가
- 파일럿 후 피드백 인터뷰가 가능한가

## No-Effect Boundary

Current status:

- outbound sales send: disabled
- store creation: disabled
- customer data import: disabled
- real customer data read: disabled
- payment automation: disabled
- subscription write: disabled
- actual delivery: disabled
- provider integration: disabled
- raw recipient resolution: disabled
- API key/env addition: disabled
- webhook registration: disabled

## Code Contract

The pure contract is `buildPilotSalesKitPlan()`.

Required values:

- `salesKitPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `primaryOfferPlan: "growth"`
- `primaryOfferMonthlyPriceKrw: 99000`
- `targetPilotStoreCount: { min: 3, max: 5 }`
- `outboundEnabled: false`
- `storeCreationEnabled: false`
- `customerDataImportEnabled: false`
- `paymentAutomationEnabled: false`
- `actualDeliveryEnabled: false`
- `providerIntegrationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `requiresOwnerApprovalBeforeUse: true`
- `requiresPrivacyBoundaryExplanation: true`
- `requiresReadOnlyPilotExplanation: true`
- `requiredSalesAssets: ["three_minute_pitch", "thirty_second_pitch", "pricing_pitch", "objection_handling", "pre_contract_checklist"]`
- `blockedActions: ["send_sales_sms", "send_sales_kakao", "send_sales_email", "create_store", "import_customer_data", "read_real_customer_data", "charge_payment", "create_subscription", "write_subscription", "resolve_raw_recipient", "add_api_key", "add_env", "register_webhook"]`

This contract is pure and in-memory. It must not call a provider, send a sales message, create a store, import customer data, read real customer data, charge a payment, create or write a subscription, resolve raw recipients, add keys, add env vars, register webhooks, or write production data.

## Related Documents

- `docs/pilot-objection-handling.md`
- `docs/pilot-consultation-record-template.md`
- `docs/pilot-pre-contract-checklist.md`
- `docs/pilot-demo-scenario.md`
- `docs/pilot-store-onboarding-checklist.md`
- `docs/july-pricing-plan-lock.md`
