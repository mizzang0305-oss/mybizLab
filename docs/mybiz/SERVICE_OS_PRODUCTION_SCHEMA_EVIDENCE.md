---
type: schema-preflight-evidence
project: MyBiz
status: live-metadata-bound-foundation-only
updated: 2026-09-14
tags: [mybiz, service-os, supabase, schema, preflight]
---

# Service OS Production Schema Evidence

## 현재 판정

```text
PROJECT_NAME=Mybiz Project
PROJECT_REF=plnuyudyogbzwpmdulnw
REGION=ap-northeast-2
PROJECT_STATUS=ACTIVE_HEALTHY
POSTGRES_VERSION=17.6.1.063
POSTGRES_ENGINE=17
```

Owner가 지정한 exact project만 catalog/aggregate read-only로 확인했다. Production
SQL write, DDL, migration apply/history repair는 모두 `0`이다. credential, connection
string, 개별 user/customer identifier는 조회하거나 기록하지 않았다.

## 허용된 metadata 범위

정확한 프로젝트가 별도 Owner Gate에서 식별되면 [read-only inventory](../../supabase/tests/mybiz_service_os_production_metadata_read_only.sql)만 사용한다. 이 쿼리는 `pg_catalog`와 `information_schema`의 다음 항목만 읽는다.

- PostgreSQL version
- required table/column names and types
- PK, unique, FK definitions
- Stage 2 relation/function collision
- RLS policies and role grants
- migration history relation의 존재 여부

애플리케이션 행, 고객 데이터, 토큰, credential, 환경변수 값은 읽지 않는다.

## Exact schema identity

| Object | Verified Production truth |
| --- | --- |
| `stores` PK | `store_id uuid` |
| `customers` PK | `customer_id uuid` |
| `profiles` PK | `id uuid` |
| `auth.users` PK | `id uuid` |
| `store_members.store_id` | FK → `stores.store_id` |
| `store_members.profile_id` | FK → `profiles.id` |
| `store_subscriptions.store_id` | FK → `stores.store_id` |
| `customers.store_id` | FK → `stores.store_id` |
| `contracts` | ABSENT |
| `private` schema | ABSENT |
| all 11 Stage 2 target tables | ABSENT |
| six Stage 2 private function names | ABSENT |
| checked Stage 2 migration identifiers/names | 0 matches |

## Sanitized auth aggregates

```text
profiles_count=3
auth_users_count=3
store_members_count=7
profiles_without_matching_auth_user=1
auth_users_without_matching_profile=1
store_members_without_profile=0
store_members_with_profile_auth_match=1
```

`profiles.auth_user_id`/`profiles.user_id`는 없고 `profiles → auth.users` FK도 없다.
따라서 `profiles.id == auth.uid()`는 universal invariant가 아니다.

## Foundation/activation disposition

- Foundation: invalid `contracts` dependency를 제거한 candidate만 검토 가능하다.
- Foundation authenticated INSERT/UPDATE/DELETE: DENY.
- Activation: `BLOCKED_AUTH_IDENTITY_MODEL`; draft-only, apply/promotion 금지.
- `public.is_store_member(uuid)`: 기존 함수 유지. `store_members.profile_id = auth.uid()`
  predicate를 사용하지만 전체 identity normalization을 증명하지 않는다.
