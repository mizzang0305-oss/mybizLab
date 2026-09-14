---
type: certification-report
project: MyBiz
status: rehearsal-pending
updated: 2026-09-14
tags: [mybiz, service-os, foundation, supabase, owner-gate]
---

# Service OS Foundation Production Readiness R2

## Scope

Exact Production metadata에 candidate를 맞추되 Production에는 아무것도 적용하지
않는다. 대상은 Foundation DDL뿐이며 activation은 별도 차단 상태다.

## Live binding

```text
PROJECT_REF=plnuyudyogbzwpmdulnw
POSTGRES_VERSION=17.6.1.063
STORES_PK=store_id
CUSTOMERS_PK=customer_id
CONTRACTS_TABLE_EXISTS=false
PRIVATE_SCHEMA_EXISTS=false
STAGE2_TABLE_COLLISIONS=NONE
STAGE2_HISTORY_COLLISION=NONE
```

## Repair

```text
OLD_FOUNDATION_SHA256=7151C23A5CE5B9D51396B8BF4B7A676AA483F41F82E0207A86037A66FA75307D
NEW_FOUNDATION_SHA256=204D6CFA650E39563B1FC7F5A35795F51395349D7369C141492A9AD7EB698A4F

REMOVED_INVALID_CONTRACT_DEPENDENCY=true
BOUND_TO_LIVE_STORE_PK=true
BOUND_TO_LIVE_CUSTOMER_PK=true
PRESERVED_AUTH_FAIL_CLOSED=true
```

`serviceOs.ts`에는 persisted contract ID가 없고 contract는 optional module이다.
따라서 Foundation은 `contract_id` column과 FK를 모두 제거하고
`requires_contract`/`contract_state` state invariant만 유지한다.

## Identity hold

```text
ACTOR_REFERENCE_DOMAIN=PROFILE_ID
FOUNDATION_BROWSER_WRITE_SURFACE=0
LIVE_WRITE_ACTIVATION_STATUS=BLOCKED_AUTH_IDENTITY_MODEL
LIVE_WRITE_ACTIVATION_READY=false
```

## Rehearsal status

Source 변경 직후 상태는 `PENDING_CI`. Exact-head GitHub Actions evidence를 얻기
전에는 Foundation readiness certification을 발행하지 않는다.

## Safety

Production DB apply/migration promotion/history repair, auth/customer/payment/signature/
SNS mutation, Production deploy 및 merge는 모두 수행하지 않는다.
