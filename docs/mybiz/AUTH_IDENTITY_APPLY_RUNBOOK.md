---
type: apply-runbook
project: MyBiz
status: owner-approval-required
updated: 2026-09-14
tags: [mybiz, service-os, auth, runbook]
---

# Auth Identity Foundation Apply Runbook

이 문서는 future one-time apply 절차다. Readiness R1에서는 실행하지 않는다.

## Preflight

- exact project `plnuyudyogbzwpmdulnw`, status, PostgreSQL version을 재확인한다.
- reviewed branch/head와 Auth candidate SHA-256을 재확인한다.
- Foundation relation 11개와 migration history가 존재하고 Stage 2 row가 0인지 확인한다.
- auth/core 3/3 one-to-one, FK, trigger와 function fingerprint를 재확인한다.
- public profile 3, exact 2, unbound 1을 재확인한다.
- membership 7, exact 1, legacy 6을 재확인한다.
- global dependency 42와 `public.is_store_member()` fingerprint를 재확인한다.
- binding table/resolver/migration collision이 0인지 확인한다.
- browser live-write grants/policies와 activation history가 0인지 확인한다.
- exact Owner apply command가 없으면 STOP한다.

## Apply

- 검토된 Auth Identity Foundation migration만 official migration 위치로 승격한다.
- policy alignment는 승인 범위에 명시된 경우에만 별도 migration으로 적용한다.
- transaction 실패 시 자동 retry하지 않는다.
- live-write activation V1/V2 SQL을 실행하지 않는다.
- customer/auth/public-profile/store-member DML을 실행하지 않는다.
- migration 안의 exact-ID triple backfill 외 mapping DML을 실행하지 않는다.

## Postcheck

```text
EXACT_ID_BINDINGS=2
LEGACY_UNBOUND_PUBLIC_PROFILES=1
BOUND_MEMBERSHIPS=1
LEGACY_UNBOUND_MEMBERSHIPS=6
UNBOUND_LEGACY_PROFILE_AUTH_ACCESS=DENIED
BROWSER_BINDING_TABLE_GRANTS=0
SERVICE_OS_LIVE_WRITE_ENABLED=false
```

또한 core trigger/global function fingerprints가 같고, Stage 2 policy alignment가 승인된 경우 정확히 9개만 바뀌었으며 vertical-template policy와 confirmation-link read deny가 그대로인지 확인한다. Independent postcheck 증거를 저장하고 STOP한다.

## 분리된 다음 Gate

- legacy manual binding: separate Owner-verified identity gate
- Service OS live-write activation: Auth Foundation apply 인증 이후 별도 gate
- global 42-policy migration: not authorized
- Production app deploy: not authorized
