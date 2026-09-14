---
type: apply-runbook
project: MyBiz
status: draft-not-authorized
updated: 2026-09-14
tags: [mybiz, service-os, supabase, owner-gate]
---

# Service OS Production Apply Runbook

이 문서는 향후 Foundation-only Owner 승인용 준비 문서다. 이번 R2에서는 어떤
Production apply도 실행하지 않는다. Browser write activation은 이 runbook 범위 밖이다.

## Foundation-only 승인 실행 순서

1. exact project ref `plnuyudyogbzwpmdulnw`와 `ACTIVE_HEALTHY` 상태를 재확인한다.
2. 현재 schema fingerprint를 다시 수집하고 stores/customers keys, contracts/private/
   Stage 2 absence, migration history collision0을 비교한다.
3. `DEFAULT_SERVICE_OS_ACTIVATION`과 모든 live-write flags가 OFF인지 확인한다.
4. 승인된 exact SHA의 `20260914005630_mybiz_service_os_foundation.sql`만 적용한다.
5. 11개 table, columns, constraints, indexes, triggers와 private functions를 검증한다.
6. 모든 table의 RLS enabled/forced, policy와 grants를 검증한다.
7. 11개 Stage 2 table row count가 각각 0인지 확인한다.
8. synthetic identity만 사용해 cross-tenant negative certification을 수행한다.
9. non-Stage2 application 및 homepage smoke를 수행한다.
10. STOP. 결과를 Owner에게 제출하고 activation을 실행하지 않는다.

## 명시적으로 제외되는 activation

`20260914005632_mybiz_service_os_live_write_activation.sql`은
`BLOCKED_AUTH_IDENTITY_MODEL`이다. 동일 Gate에서 apply, grant 확대, policy 생성,
customer job/evidence/confirmation/payment/content mutation을 수행하지 않는다.

## 즉시 중단 조건

- target/ref/SHA 불일치
- required PK/FK/function 불일치
- `public.contracts` 의존 재발 또는 `service_jobs.contract_id` 재등장
- unexpected relation, function, policy collision
- migration history 불일치
- authenticated grant 확대 또는 RLS 미적용
- 실제 고객 행/외부 provider가 필요해지는 경우
