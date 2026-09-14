---
type: production-evidence
project: MyBiz
status: sanitized-read-only-snapshot
updated: 2026-09-14
tags: [mybiz, service-os, auth, production, evidence]
---

# Auth Identity Production Evidence

## Target

```text
PROJECT_NAME=Mybiz Project
PROJECT_REF=plnuyudyogbzwpmdulnw
REGION=ap-northeast-2
POSTGRES_VERSION=17.6.1.063
STATUS=ACTIVE_HEALTHY
FOUNDATION_MIGRATION=20260914041214_mybiz_service_os_foundation
```

2026-09-14에 Production catalog와 aggregate count만 read-only 조회했다. UUID, email, name, phone, auth metadata, JWT, session, cookie, secret은 조회 결과나 문서에 기록하지 않았다.

## Canonical Auth truth

```text
AUTH_USERS_COUNT=3
CORE_PROFILES_COUNT=3
AUTH_WITHOUT_CORE_PROFILE=0
CORE_PROFILE_WITHOUT_AUTH=0
CORE_PROFILE_AUTH_FK=true
AUTH_USER_CREATE_TRIGGER=on_auth_user_created
AUTH_USER_CREATE_FUNCTION=core.handle_auth_user_created()
CORE_AUTH_CANONICAL=true
```

`core.profiles.id`는 `auth.users.id`를 FK로 참조한다. `auth.users` AFTER INSERT trigger는 `core.handle_auth_user_created()`를 실행하고 `new.id`로 core profile을 만든다.

## Public legacy identity and membership

```text
PUBLIC_PROFILES_COUNT=3
PUBLIC_PROFILE_EXACT_ID_MATCH_COUNT=2
PUBLIC_PROFILE_UNBOUND_COUNT=1
AUTH_USERS_WITHOUT_MATCHING_PUBLIC_PROFILE=1
STORE_MEMBERS_TOTAL=7
DISTINCT_STORE_MEMBER_PROFILE_IDS=2
EXACT_ID_BOUND_MEMBERSHIPS=1
LEGACY_UNBOUND_MEMBERSHIPS=6
UNMATCHED_PUBLIC_UNIQUE_CORE_EMAIL_MATCH=0
UNMATCHED_PUBLIC_UNIQUE_AUTH_EMAIL_MATCH=0
```

따라서 legacy public profile 1개와 그 membership 6개는 `LEGACY_UNBOUND`로 보존한다. email/name/phone/ownership/time/fuzzy matching은 허용되지 않는다.

## Blast radius and Service OS

```text
IS_STORE_MEMBER_POLICY_DEPENDENCIES=42
GLOBAL_IS_STORE_MEMBER_CHANGED=false
STAGE2_RELATIONS=11
STAGE2_TOTAL_ROWS=0
STAGE2_SELECT_POLICIES=10
STAGE2_MEMBERSHIP_SELECT_POLICIES=9
CORE_ORGANIZATIONS=0
CORE_MEMBERSHIPS=0
AUTH_IDENTITY_MIGRATION_APPLIED=0
LIVE_WRITE_ACTIVATION_APPLIED=false
```

이 문서는 readiness 시점 snapshot이다. Owner-approved apply 직전에 같은 catalog/count/function fingerprint를 다시 확인해야 한다.
