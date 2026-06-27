# Pilot Outreach Manual Kit

This document defines the July 2026 pilot outreach manual kit only.

It provides owner-reviewed copy for in-person visits, phone openings, manual Kakao copy, follow-up language, and conversion grading. It does not send messages, create leads, create stores, import customer data, read real customer data, charge payments, create subscriptions, integrate providers, resolve raw recipients, add API keys, add env vars, register webhooks, or write production data.

## Purpose

MyBiz is positioned as a memory-based revenue engine SaaS. The July pilot outreach kit helps explain that positioning to 3 to 5 candidate stores while keeping the pilot read-only and owner-approved.

The primary offer is Growth 99,000 KRW. The pitch should focus on customer memory, revisit opportunities, average order value lift, and privacy-safe pilot validation before any operational expansion.

## 방문 30초 오프닝

사장님, MyBiz는 주문 접수나 단순 CRM이 아니라 단골 고객을 기억해서 재방문과 객단가를 높이는 매장용 기억 기반 매출 엔진입니다.

지금 단계에서는 실제 문자 발송이나 개인정보 자동 처리를 하지 않습니다. 먼저 고객 기억 카드, VIP 후보, 캠페인 준비 미리보기를 read-only로 보여드리고, 이 매장에 실제 매출 기회가 있는지 7월 파일럿으로 확인합니다.

권장 파일럿 플랜은 Growth 99,000원입니다. 단골 고객 기억이 매장 운영과 재방문 제안에 도움이 되는지 먼저 검증하는 구조입니다.

## 전화 30초 오프닝

사장님, 단골 고객 취향이나 반복 주문 정보가 직원 기억에만 남아 있는지 확인하려고 연락드렸습니다.

MyBiz는 그 기억을 시스템에 정리해서 누구에게 무엇을 제안하면 좋을지 보여주는 기억 기반 매출 엔진입니다.

7월 파일럿은 실제 발송 없이 read-only로 시작합니다. Growth 99,000원 기준으로 3~5곳만 먼저 확인하려고 합니다.

## 수동 카카오 초안

사장님 안녕하세요.

MyBiz 7월 파일럿을 안내드립니다.

MyBiz는 단순 주문 접수나 CRM이 아니라, 단골 고객의 취향, 방문, 주문 맥락을 기억해서 재방문과 객단가 상승 기회를 보여주는 기억 기반 매출 엔진입니다.

이번 파일럿은 실제 문자/카카오/이메일 발송 없이 read-only로 진행합니다. 먼저 고객 기억 카드, VIP 후보, 캠페인 준비 미리보기를 통해 "누구에게 무엇을 제안할지"가 보이는지 확인합니다.

권장 플랜은 Growth 99,000원입니다. 관심 있으시면 짧은 데모로 보여드리겠습니다.

## 후속 상담 멘트

오늘 이야기 기준으로 보면 사장님 매장은 단골, 반복 주문, 취향 정보가 있어 MyBiz 파일럿 적합성이 있습니다.

다음 단계는 실제 고객 데이터를 바로 넣는 것이 아닙니다. read-only 데모 기준으로 고객 기억 카드와 VIP 후보가 매장 운영에 도움이 되는지 확인하는 것입니다.

Growth 99,000원 기준으로 파일럿을 검토하시고, 가능하면 다음 상담에서 HOT/WARM/COLD/NO_FIT 기준으로 진행 여부를 정리하겠습니다.

## HOT/WARM/COLD/NO_FIT 전환 등급 기준

### HOT

- 단골 또는 반복 주문이 명확하다.
- 고객 취향, 선호 옵션, 선호 메뉴가 매출에 중요하다.
- Growth 99,000원에 강한 거부감이 없다.
- read-only 파일럿 구조를 이해했다.
- 피드백 또는 인터뷰가 가능하다.

### WARM

- 필요성은 있으나 가격, 개인정보, 운영 방식 추가 설명이 필요하다.
- Starter 또는 Growth 사이에서 고민한다.

### COLD

- 무료 사용만 원한다.
- 실제 발송 자동화만 원한다.
- 고객 기억 가치에 대한 반응이 약하다.

### NO_FIT

- 일회성 고객 위주다.
- 개인정보 동의 구조를 거부한다.
- 파일럿 피드백이 어렵다.

## 금지 표현

- 매출 보장 금지
- 자동 발송 가능하다고 말하지 않기
- 고객 데이터 자동 수집 가능하다고 말하지 않기
- 결제 자동화가 열린 것처럼 말하지 않기
- owner approval 없이 실제 고객 사례를 말하지 않기
- 정부지원사업 선정/승인 보장 금지

## No-Effect Boundary

Current status:

- manual copy only: enabled
- outbound automation: disabled
- sales SMS/Kakao/Email: disabled
- lead creation: disabled
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

The pure contract is `buildPilotOutreachManualKitPlan()`.

Required values:

- `outreachKitPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `primaryOfferPlan: "growth"`
- `primaryOfferMonthlyPriceKrw: 99000`
- `targetPilotStoreCount: { min: 3, max: 5 }`
- `manualCopyOnly: true`
- `outboundAutomationEnabled: false`
- `sendSalesSmsEnabled: false`
- `sendSalesKakaoEnabled: false`
- `sendSalesEmailEnabled: false`
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

## Related Documents

- `docs/pilot-follow-up-script.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-consultation-record-template.md`
