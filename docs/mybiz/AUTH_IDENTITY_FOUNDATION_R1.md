---
type: architecture
project: MyBiz
status: owner-apply-gate-required
updated: 2026-09-14
tags: [mybiz, service-os, auth, identity, rls]
---

# Auth Identity Foundation R1

## 목적

Service OS의 인증 사용자를 business actor와 명시적으로 연결하되, Production write를 활성화하거나 legacy membership을 재할당하지 않는다.

```text
auth.users
  -> core.profiles                 canonical Auth identity
  -> private.profile_auth_bindings explicit protected bridge
  -> public.profiles               business / legacy actor
  -> public.store_members          business membership
  -> Service OS
```

`core.profiles.id = auth.users.id`는 Production FK와 Auth insert trigger로 확인된 canonical invariant다. `public.profiles.id = auth.uid()`는 3개 중 2개에만 성립하므로 universal invariant가 아니다.

## 선택한 최소 설계

`CREATE_STORE_WITH_OWNER_COMPATIBILITY=B`로 결정한다.

- `public.create_store_with_owner()`는 변경하지 않는다.
- resolver는 ACTIVE explicit binding을 먼저 사용한다.
- 어느 쪽에도 binding 이력이 없을 때만 `auth.users.id = core.profiles.id = public.profiles.id` exact-ID triple fallback을 허용한다.
- REVOKED binding이 있으면 exact-ID fallback도 금지한다.
- 기존 exact-ID 2건은 명시적 `EXACT_ID` binding으로 backfill한다.

이 방식은 신규 canonical owner의 기존 exact-ID 경로를 보존하면서 Production RPC를 재작성하지 않는다. 향후 RPC가 명시 binding을 함께 만드는 변경은 별도 Gate다.

## Binding contract

`private.profile_auth_bindings`는 browser Data API에 노출되지 않는 protected table이다. 허용 source는 `EXACT_ID`, `OWNER_VERIFIED`, `MIGRATION_VERIFIED`, `ADMIN_VERIFIED`뿐이다. ACTIVE binding은 public profile과 Auth/Core profile 양쪽에서 각각 최대 1개다.

Resolver:

- `private.current_service_os_business_profile_id()`
- `private.is_service_os_store_member(uuid)`

두 함수는 caller-supplied profile ID를 받지 않고 내부에서 `auth.uid()`를 확인한다. `SECURITY DEFINER`, `STABLE`, `search_path=''`, PUBLIC/anon EXECUTE revoke를 적용하며 authenticated에는 함수 호출에 필요한 schema USAGE와 두 함수 EXECUTE만 허용한다.

## Stage 2 범위

Foundation SELECT policy는 10개다. 이 중 membership 기반 9개만 별도 policy-alignment draft에서 Service OS resolver를 사용한다. `vertical_templates_public_v1_select`는 그대로 유지하고 `job_confirmation_links` browser read는 계속 금지한다.

`public.is_store_member()`와 Production의 기존 42개 dependency를 변경하지 않는다. 전역 auth/RLS rewrite, `core.organizations` 도입, public profile own-policy rewrite는 범위 밖이다.

## Creator identity

`service_jobs.created_by`, `job_evidence_revisions.created_by`, `job_evidence_assets.uploader_user_id`는 public business profile FK로 유지한다. 미래 browser write는 요청 actor가 resolver 결과와 같아야 하며 client가 actor profile을 임의 선택할 수 없다.

## Rehearsal acceptance

```text
AUTH_USERS=3
CORE_PROFILES=3
PUBLIC_PROFILES=3
EXACT_ID_BINDINGS=2
LEGACY_UNBOUND=1
BOUND_MEMBERSHIPS=1
LEGACY_UNBOUND_MEMBERSHIPS=6
EXACT_OWNER_OWN_STORE=ALLOW
WRONG_STORE=DENY
NON_MEMBER=DENY
UNBOUND_LEGACY=DENY
REVOKED_BINDING=DENY
OWNER_VERIFIED_MANUAL_BIND=CHOSEN_AUTH_ONLY
```

## 비활성 경계

```text
SERVICE_OS_LIVE_WRITE_ENABLED=false
ACTIVATION_MIGRATION_APPLIED=false
GLOBAL_IS_STORE_MEMBER_CHANGED=false
STORE_MEMBER_ROWS_REASSIGNED=0
CORE_AUTH_TRIGGER_CHANGED=false
```
