---
type: schema-preflight-evidence
project: MyBiz
status: blocked-live-identity
updated: 2026-09-14
tags: [mybiz, service-os, supabase, schema, preflight]
---

# Service OS Production Schema Evidence

## 현재 판정

`LIVE_PROJECT_ID=NOT_VERIFIED`이며 Production metadata gate는 닫혀 있다. 현재 인증된 Supabase 연결에서 MyBiz 프로젝트가 식별되지 않았고, 공개 Production bundle에도 프로젝트 참조가 없었다. 프로젝트를 추측하거나 Vercel 환경변수 값을 읽지 않았다. 따라서 이번 작업에서 Production SQL은 읽기와 쓰기 모두 `0`이다.

## 허용된 metadata 범위

정확한 프로젝트가 별도 Owner Gate에서 식별되면 [read-only inventory](../../supabase/tests/mybiz_service_os_production_metadata_read_only.sql)만 사용한다. 이 쿼리는 `pg_catalog`와 `information_schema`의 다음 항목만 읽는다.

- PostgreSQL version
- required table/column names and types
- PK, unique, FK definitions
- Stage 2 relation/function collision
- RLS policies and role grants
- migration history relation의 존재 여부

애플리케이션 행, 고객 데이터, 토큰, credential, 환경변수 값은 읽지 않는다.

## 과거 sanitized evidence — 최신성 미보장

기존 저장소 문서에는 다음 형태가 기록되어 있으나 현재 Production 재조회 결과가 아니다.

- `stores.store_id` primary key
- `store_members.store_id → stores.store_id`
- `store_members.profile_id → profiles.id`
- `store_subscriptions.store_id → stores.store_id`
- `customers.customer_id` primary key
- `profiles.id` primary key

## P0 미확인 항목

| 항목 | 현재 상태 | 승격 영향 |
| --- | --- | --- |
| exact MyBiz Supabase project | NOT_VERIFIED | apply 대상 특정 불가 |
| PostgreSQL major version | NOT_VERIFIED | 호환성 입증 불가 |
| `contracts.id` uniqueness 및 `contracts.store_id` | NOT_VERIFIED | service job FK/tenant relation 차단 |
| `profiles.id → auth.users.id` FK | NOT_VERIFIED | browser write activation 차단 |
| Stage 2 table/function/policy collision | NOT_VERIFIED | 충돌/부분 설치 위험 |
| live migration history | NOT_VERIFIED | 적용 순서 및 중복 여부 판정 불가 |
| `private` schema 기존 권한/객체 | NOT_VERIFIED | broad revoke 금지, 개별 객체 검토 필요 |

결론: isolated rehearsal이 성공해도 이 표가 해소되기 전에는 `PROMOTION_READY=false`이다.
