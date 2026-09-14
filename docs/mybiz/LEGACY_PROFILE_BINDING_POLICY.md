---
type: policy
project: MyBiz
status: approved-design-not-applied
updated: 2026-09-14
tags: [mybiz, auth, legacy, binding]
---

# Legacy Profile Binding Policy

## 허용과 금지

허용 `binding_source`:

- `EXACT_ID`
- `OWNER_VERIFIED`
- `MIGRATION_VERIFIED`
- `ADMIN_VERIFIED`

금지:

- email, name, phone 일치 추정
- store ownership 또는 생성 시각 추정
- fuzzy/similarity matching
- 현재 로그인 사용자를 legacy profile에 임의 연결

`LEGACY_PROFILE_AUTO_BINDING=false`다. 현재 unbound legacy profile과 6개 membership은 별도 Owner-verified identity evidence가 있기 전까지 그대로 둔다.

## 상태와 권한

상태는 `ACTIVE`와 `REVOKED`다. resolver는 ACTIVE만 인정한다. REVOKED 이력이 있으면 동일 ID exact fallback도 차단한다. bind/revoke는 별도 Owner-authorized server operation이며 browser에 binding table DML 권한이나 arbitrary profile RPC를 주지 않는다.

ACTIVE 상태에서 public profile과 Auth/Core profile 양쪽은 각각 최대 한 binding만 가진다. metadata는 PII 저장소가 아니며 review reference 같은 sanitized object만 허용한다.

## Membership 보존

Binding은 `public.store_members.profile_id`를 변경하지 않는다. revoke 시 membership row를 삭제/재할당하지 않고 Auth access만 deny한다. legacy identity evidence 자체는 repository에 저장하지 않는다.

수동으로 legacy profile을 binding해도 기존 `profiles_select_own`, `profiles_insert_own`, `profiles_update_own`의 `auth.uid() = public.profiles.id` 전역 정책은 자동으로 바뀌지 않는다. 필요한 profile UI 호환은 별도 Service OS DTO/view 또는 Owner-approved policy Gate에서 다룬다.
