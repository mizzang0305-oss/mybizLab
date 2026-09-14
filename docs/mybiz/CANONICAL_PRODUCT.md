# MyBiz Canonical Product

## Canonical identity

| Field | Value |
| --- | --- |
| Company | MyBizLab |
| Product | MyBiz |
| Category | Business Service OS |
| Core promise | 작업부터 다음 고객까지. |

MyBiz는 결과와 완료 증빙이 중요한 서비스업의 한 건의 업무를 처음부터 끝까지 연결하는 구독 제품이다. 음식점 운영, 고객 기억, 예약·웨이팅·POS, 홈페이지 가운데 어느 하나도 제품 전체의 정체성이 아니다.

## Canonical flow

```text
Customer / Lead
→ Job
→ optional Contract
→ Work
→ Evidence
→ Customer Confirmation
→ Payment Tracking
→ Evidence Package
→ Channel-specific Consent
→ Merchant Approval
→ Brand / Content Asset
→ Customer Memory
→ Next Customer
```

메시지 우선순위는 업무 → 증빙 → 고객 확인 → 계약·결제 → 기록·고객 기억 → 홈페이지·콘텐츠 → 다음 고객이다. AI는 요약, 분류, 초안, 추천, 리포트, 자동화를 돕는 보조 엔진이며 첫 번째 제품 약속이 아니다.

## Value hierarchy

1. Operations: 고객, 작업, 담당자, 일정, 작업 상태
2. Evidence: 사진, 영상, 문서, 체크리스트, 버전, 원본/파생본
3. Transaction: 계약, 고객 확인, 결제 요청, 결제·환불·정정 상태
4. Memory: 고객 이력, 요청, 선호, 보완, 결제·확인 이력
5. Growth: 홈페이지, 포트폴리오, 콘텐츠, 블로그, SNS
6. Revenue: 재문의, 재방문, 추천, 신규 고객, 다음 작업

## Invariants

- Customer Memory는 cross-cutting revenue capability이며 제품 전체 정체성이 아니다.
- `store_id`/`storeId`는 legacy-compatible tenant/business/workspace scope identifier다.
- 고객 확인은 결제 완료가 아니다.
- 고객 확인은 채널별 홍보 동의가 아니다.
- 외부 게시는 채널별 동의, 업체 승인, 실제 provider receipt가 필요하다.
- 의료 업종은 기본 비활성이다.
- Production DB 적용과 provider 활성화는 별도 Owner Gate다.

## Source relationship

이 문서가 제품 정체성의 상위 기준이다. [`../MYBIZ_STAGE2_PRODUCT_SPEC.md`](../MYBIZ_STAGE2_PRODUCT_SPEC.md)는 이 기준을 구현하는 Stage 2 계약이며 대체 문서가 아니다.
