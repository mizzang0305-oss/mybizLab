# Pilot Pre-Contract Checklist

This document defines the July 2026 pilot pre-contract checklist only.

It does not create leads, create stores, import customer data, read real customer data, store consultation records, charge payments, create subscriptions, send SMS/Kakao/Email, resolve raw phone/email, add provider integrations, add API keys, add env vars, register webhooks, or write production data.

## 계약 전 필수 확인

- MyBiz가 기억 기반 매출 엔진이라는 설명을 이해했는가
- 실제 발송 없는 read-only 파일럿임을 이해했는가
- Growth 99,000원 기준을 이해했는가
- 고객 취향/주문/방문 맥락을 기록하는 목적을 이해했는가
- 개인정보/마케팅 동의 구조가 필요함을 이해했는가
- raw phone/email 접근은 아직 하지 않는다는 점을 이해했는가
- 결제 자동화는 아직 하지 않는다는 점을 이해했는가
- 파일럿 후 피드백 인터뷰에 동의 가능한가
- 파일럿 성공 기준에 합의했는가

## 파일럿 성공 기준

- 사장님이 VIP 고객 후보를 보고 납득하는가
- 사장님이 고객 기억 카드의 가치를 이해하는가
- 사장님이 누구에게 무엇을 제안할지 감을 볼 수 있는가
- 직원 기억 의존 문제를 줄일 수 있다고 보는가
- Growth 99,000원을 지속 결제할 의사가 있는가

## Privacy Boundary

상담 단계에서는 실제 고객 이름, 전화번호, 이메일, 주문 row, raw recipient, 고객 row sample을 수집하지 않습니다.
상담 메모는 매장 적합도와 다음 액션을 판단하기 위한 범주형 정보만 사용합니다.

## Read-Only Pilot Boundary

7월 파일럿은 read-only 파일럿입니다.
실제 발송, 고객 등급 수정, 고객 메모 수정, store/customer 생성, payment automation, provider integration은 별도 승인 전까지 열지 않습니다.

## Code Contract

The pure contract is `buildPilotConsultationRecordPlan()`.

Required pre-contract values:

- `consultationRecordPlanOnly: true`
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

## Related Documents

- `docs/july-launch-go-no-go-gate.md`
- `docs/demo-rehearsal-script.md`
- `docs/demo-synthetic-scenario.md`
- `docs/pilot-consultation-record-template.md`
- `docs/pilot-sales-kit.md`
- `docs/pilot-store-onboarding-checklist.md`
- `docs/july-pricing-plan-lock.md`
