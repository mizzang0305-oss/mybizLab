# Pilot Consultation Record Template

This document defines the July 2026 pilot consultation record template only.

It does not save real consultation records, create leads, create stores, import customer data, read real customer data, send sales messages, charge payments, create subscriptions, resolve raw recipients, add API keys, add env vars, register webhooks, or write production data.

## 목적

이 문서는 상담 기록 템플릿입니다.

7월 파일럿 상담 기록은 실제 개인정보/고객 데이터를 저장하는 기능이 아닙니다.
이 문서는 매장 상담 후 해당 매장이 Growth 99,000원 파일럿에 적합한지 판단하기 위한 기록 템플릿입니다.

MyBiz는 기억 기반 매출 엔진 SaaS입니다.
상담 기록은 이 매장이 단골 기억, 재방문, 객단가 상승, 직원 기억 의존 감소에 실제로 반응하는지 확인하는 데만 사용합니다.

## 상담 기록 필드

아래 항목은 상담 후 수기로 정리할 템플릿 필드입니다.
실제 전화번호, 이메일, 고객 이름, raw phone/email, 고객 row, 고객 샘플은 기록하지 않습니다.

- 상담일
- 상담자
- 매장명 placeholder
- 업종
- 지역
- 현재 고객 관리 방식
- 단골 기억 방식
- 반복 주문 여부
- 고객 취향/옵션 중요도
- 재방문 유도 필요도
- 객단가 상승 가능성
- 현재 문제 한 줄 요약
- MyBiz 관심 기능
- Growth 99,000원 반응
- 주요 반박
- 개인정보/마케팅 동의 수용 가능성
- read-only 파일럿 이해 여부
- 실제 발송 미포함 이해 여부
- 다음 액션
- 전환 가능성 등급

## 전환 가능성 등급

### HOT

- 단골/반복 주문이 선명함
- 고객 취향/옵션이 중요함
- Growth 99,000원에 거부감이 낮음
- read-only 파일럿 구조를 이해함
- 피드백 인터뷰 가능

### WARM

- 필요성은 있으나 가격, 개인정보, 운영 방식 추가 설명 필요
- Starter 또는 Growth 사이에서 고민

### COLD

- 무료만 원함
- 실제 발송 자동화만 원함
- 고객 기억 가치에 반응이 약함

### NO_FIT

- 일회성 고객 위주
- 개인정보 동의 구조 거부
- 파일럿 피드백 불가

## 상담 후 판정

- Growth 제안 가능
- Starter 진입 제안
- 후속 상담 필요
- 파일럿 부적합

## Code Contract

The pure contract is `buildPilotConsultationRecordPlan()`.

Required values:

- `consultationRecordPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `primaryOfferPlan: "growth"`
- `primaryOfferMonthlyPriceKrw: 99000`
- `recordTemplateOnly: true`
- `productionWriteEnabled: false`
- `leadCreationEnabled: false`
- `storeCreationEnabled: false`
- `customerDataImportEnabled: false`
- `realCustomerDataReadEnabled: false`
- `paymentAutomationEnabled: false`
- `actualDeliveryEnabled: false`
- `providerIntegrationEnabled: false`
- `rawRecipientResolutionEnabled: false`
- `requiresOwnerApprovalBeforeUse: true`
- `requiresPrivacyBoundaryExplanation: true`
- `requiresReadOnlyPilotExplanation: true`
- `conversionGrades: ["hot", "warm", "cold", "no_fit"]`
- `possibleNextActions: ["propose_growth", "propose_starter", "schedule_follow_up", "mark_not_fit"]`
- `blockedActions: ["write_consultation_record", "create_lead", "create_store", "import_customer_data", "read_real_customer_data", "charge_payment", "create_subscription", "write_subscription", "send_sales_sms", "send_sales_kakao", "send_sales_email", "resolve_raw_recipient", "add_api_key", "add_env", "register_webhook"]`

This contract is pure and in-memory. It must not write a consultation record, create a lead, create a store, import customer data, read real customer data, charge a payment, create or write a subscription, send sales messages, resolve raw recipients, add keys, add env vars, register webhooks, or write production data.

## Related Documents

- `docs/pilot-pre-contract-checklist.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-store-onboarding-checklist.md`
- `docs/pilot-demo-scenario.md`
