---
type: certification-report
project: MyBiz
status: certified-owner-gate
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

## Rehearsal certification

GitHub-hosted `ubuntu-24.04`의 ephemeral Docker/Supabase stack에서 repaired
Foundation candidate를 Production-shape fixture에 두 번 적용했다. 이 evidence run은
candidate code SHA `086d6f1d204aa5b49a1ba1b7e966cdf73045d774`를 checkout했고,
Production project에 link하거나 SQL write를 실행하지 않았다.

```text
EVIDENCE_RUN_ID=34798638905
EVIDENCE_RUN_URL=https://github.com/mizzang0305-oss/mybizLab/actions/runs/34798638905
EVIDENCE_HEAD_SHA=086d6f1d204aa5b49a1ba1b7e966cdf73045d774

RUNNER=ubuntu-24.04
DOCKER_SERVER_VERSION=28.0.4
SUPABASE_CLI_VERSION=2.117.0
EPHEMERAL_POSTGRES_VERSION=17.6

REHEARSAL_R2_RUN_1=PASS
REHEARSAL_R2_RUN_2=PASS
PGTAP_RUN_1=59/59 PASS
PGTAP_RUN_2=59/59 PASS
REVISION_CONCURRENT_NO_DUPLICATE=PASS
FAILED_TRANSACTION_PARTIAL_OBJECTS=0
PRE_WRITE_ROLLBACK_READY=PASS
DB_LINT=PASS

FOCUSED_TESTS=87/87 PASS
FULL_TESTS=917/917 PASS
PRODUCTION_DEPENDENCY_VULNERABILITIES=0
```

The first direct local full-suite invocation observed one unrelated transient
`spawnSync` failure (`916/917`); its isolated rerun passed `9/9`. The clean GitHub
runner then passed the complete suite `917/917`, which is the authoritative
reproducible regression result for this candidate.

Foundation readiness is certified only for the reviewed DDL package. Production
apply remains an explicit Owner Gate, and live-write activation remains blocked by
the unresolved auth/profile identity model.

## Safety

Production DB apply/migration promotion/history repair, auth/customer/payment/signature/
SNS mutation, Production deploy 및 merge는 모두 수행하지 않는다.
