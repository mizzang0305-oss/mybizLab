---
type: domain-boundary
project: MyBiz
status: foundation-ready-contract-deferred
updated: 2026-09-14
tags: [mybiz, service-os, contract, schema]
---

# Service OS Contract Module Boundary

## 결정

```text
CONTRACT_IS_OPTIONAL_MODULE=true
FOUNDATION_CONTRACT_FK=false
FOUNDATION_REQUIRES_CONTRACT_TABLE=false
CONTRACT_MODULE_BINDING=DEFERRED
```

Production에는 `public.contracts` relation이 없다. Service OS Foundation은
존재하지 않는 relation에 의존하거나 이를 만족시키기 위한 placeholder table을
만들지 않는다. `service_jobs`에는 `contract_id`를 두지 않는다.

## Foundation에서 유지하는 계약 상태

`requires_contract`와 `contract_state`는 작업 시작 가능 여부를 표현하는 독립적인
workflow state다. `DRAFT`/`SENT` 작업은 `WORK_READY`가 될 수 없고,
`ACCEPTED`/`SIGNED` 또는 `NOT_REQUIRED`만 허용한다.

이는 전자계약 체결이나 법적 효력을 주장하지 않는다.

## 향후 canonical contract binding 조건

다음은 별도의 additive migration과 독립 Owner Gate가 필요하다.

- canonical contract entity와 ownership model
- 전자서명 provider 및 법적 보존 범위
- Service Job과 contract의 tenant-safe FK
- contract ID lifecycle과 correction/void/version 정책
- RLS, service adapter, rollback 및 Production rehearsal

기존 Foundation을 수정해 가짜 contract table을 삽입하거나 demo contract model에
연결하지 않는다.
