# Pilot Objection Handling

This document defines read-only objection handling for the July 2026 pilot sales kit.

It does not contact prospects, send SMS/Kakao/Email, create stores, import customer data, read real customer data, charge payments, create subscriptions, add provider SDKs, add API keys, add env vars, or register webhooks.

## 1. "우리는 단골 다 기억해요."

지금은 기억하지만 직원이 바뀌거나 바쁜 시간에는 빠집니다.
MyBiz는 그 기억을 매장 자산으로 남기는 겁니다.

## 2. "문자 자동 발송 하는 거예요?"

7월 파일럿은 발송하지 않습니다.
먼저 안전하게 고객 기억과 추천 대상을 보는 단계입니다.

## 3. "CRM이랑 뭐가 달라요?"

CRM은 고객 목록 관리에 가깝고, MyBiz는 주문, 취향, 방문 맥락을 기억해서 다음 매출 행동을 준비합니다.

## 4. "비싸요."

월 99,000원은 단골 서너 명의 재방문만 만들어도 회수 가능한 금액입니다.
핵심은 광고비가 아니라 기존 단골 매출을 놓치지 않는 겁니다.

## 5. "개인정보 괜찮아요?"

실제 발송과 원시 연락처 접근은 하지 않고, 동의와 승인 구조를 먼저 확인합니다.
파일럿은 read-only로 시작합니다.

## 6. "지금 당장 필요한가요?"

단골 데이터는 쌓을수록 자산입니다.
지금부터 쌓아야 1~2개월 뒤 추천과 리포트 가치가 생깁니다.

## Required Sales Boundary

- outbound sales send: disabled
- store creation: disabled
- customer data import: disabled
- real customer data read: disabled
- payment automation: disabled
- subscription write: disabled
- provider integration: disabled
- actual delivery: disabled
- raw recipient resolution: disabled
- API key/env addition: disabled
- webhook registration: disabled

## Related Contract

The pure contract is `buildPilotSalesKitPlan()`.

The document must stay aligned with:

- `docs/pilot-sales-kit.md`
- `docs/pilot-store-onboarding-checklist.md`
- `docs/pilot-demo-scenario.md`
