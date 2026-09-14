---
type: rollback-plan
project: MyBiz
status: rehearsed-window-a-only
updated: 2026-09-14
tags: [mybiz, service-os, auth, rollback]
---

# Auth Identity Rollback Plan

## Window A: destructive rollback 허용 조건

다음이 모두 참일 때만 Auth 전용 forward rollback migration을 사용할 수 있다.

- Service OS live write row가 0이다.
- authenticated write grant/policy가 0이다.
- binding은 ACTIVE `EXACT_ID` triple-equality seed만 존재한다.
- `OWNER_VERIFIED`, `ADMIN_VERIFIED`, `MIGRATION_VERIFIED`, REVOKED 이력이 0이다.
- 후속 identity migration dependency가 없다.
- global function/core trigger fingerprint와 policy baseline이 확보되어 있다.

역순 절차:

1. Stage 2 SELECT policy 9개를 `public.is_store_member(store_id)` predicate로 복원한다.
2. `private.is_service_os_store_member(uuid)`를 제거한다.
3. `private.current_service_os_business_profile_id()`를 제거한다.
4. exact-ID seed와 `private.profile_auth_bindings`를 제거한다.
5. Auth candidate가 추가한 authenticated private-schema USAGE만 회수한다.
6. migration history를 수동 삭제하지 않고 별도 forward rollback migration으로 기록한다.
7. global function/dependency, core trigger, 11 Foundation relation/function, grants를 재검증한다.

`private` schema 자체는 절대 drop하지 않는다. Foundation의 기존 private 함수가 존재한다.

## Window B: binding 또는 live write 이후

Manual verified binding, revoked history, 또는 live write가 하나라도 있으면 mapping data를 drop하지 않는다. resolver/policy를 fail-closed하고 binding을 보존한 채 forward-fix한다. membership 재할당이나 Production Auth data 수정은 rollback으로 간주하지 않는다.

## Rehearsal result boundary

Local ephemeral rehearsal은 synthetic exact seed 2건, Stage 2 row 0에서만 수행한다. Production rollback 실행은 별도 Owner approval 대상이다.
