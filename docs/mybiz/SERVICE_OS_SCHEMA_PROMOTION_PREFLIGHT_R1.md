---
type: certification-report
project: MyBiz
status: isolated-certified-live-metadata-blocked
updated: 2026-09-14
tags: [mybiz, service-os, schema, rls, preflight]
---

# Service OS Schema Promotion Preflight R1

## 목적과 안전 경계

R3 exact head `130b65d350e65dd89e0af9c8af91138885df98eb` 위에서 Stage 2 draft를 Production-shaped fixture에 맞게 복구하고, foundation과 browser write activation을 분리한다. Production DB apply, migration promotion, remote SQL, Production deploy, main/R3 merge는 수행하지 않는다.

## Draft lineage

| 파일 | 처분 |
| --- | --- |
| `20260913083614_mybiz_stage2_service_os.sql` | 기존 R2 certification 보존, 수정하지 않음; SHA-256 `92B9268517D4E1BF9A62D3E34A9894BE38940AAB8BE7307DBAB1D41EE88BF56D` |
| `20260914005630_mybiz_service_os_foundation.sql` | 새 foundation candidate, browser write 없음; SHA-256 `7151C23A5CE5B9D51396B8BF4B7A676AA483F41F82E0207A86037A66FA75307D` |
| `20260914005632_mybiz_service_os_live_write_activation.sql` | 별도 Owner Gate candidate; SHA-256 `F8BFF9DBD038507F59C7EA0F7B881B1B7810F3F042D0082030FFA4158384921D` |

## FK 정렬

| child | target | foundation preflight |
| --- | --- | --- |
| all Stage 2 tenant keys | `stores.store_id` | unique/PK 필수 |
| `service_jobs.customer_id` | `customers.customer_id` | unique/PK 필수 |
| `service_jobs.contract_id` | `contracts.id` | unique/PK 필수 |
| actor/uploader/revision creator | `profiles.id` | unique/PK 필수 |
| all job children | `(service_jobs.id, service_jobs.store_id)` | composite FK |
| revision-bound children | `(job_id, revision_number, store_id)` | exact revision FK |
| portfolio candidate | `(candidate, job, revision, store)` | exact candidate FK |

## 권한/RLS 모델

| role | SELECT | INSERT/UPDATE/DELETE | private functions |
| --- | --- | --- | --- |
| `anon` | DENY | DENY | DENY |
| `authenticated` | membership 기반, token link 제외 | foundation에서 DENY | DENY |
| `service_role` | ALLOW | ALLOW | 지정된 3개만 ALLOW |

11개 Stage 2 table 모두 RLS를 `ENABLE` 및 `FORCE`한다. `private` schema 전체 권한을 일괄 변경하지 않고 새 function별 권한만 제한한다.

## Rehearsal contract

- GitHub-hosted `ubuntu-24.04`의 ephemeral Docker만 사용
- Supabase CLI `2.117.0` 고정
- Production-shaped baseline → active migrations → foundation candidate
- known-failure transaction이 partial Stage 2 object `0`임을 증명
- clean reset 기반 동일 rehearsal 2회
- pgTAP 55 assertions 및 concurrent revision test를 매회 실행
- Window A reverse-order down 후 Stage 2 relation `0`
- DB lint, app lint/typecheck/build/focused/full/audit 수행
- remote link/project ref/DB URL/Production secrets 없음

## Isolated runtime evidence

- GitHub Actions run: `34795627237`
- certified source SHA: `f8f701db01ba1d4ee12a0b9f778193f09ff811b7`
- runner: `ubuntu-24.04`, Docker Server `28.0.4`
- Supabase CLI: `2.117.0`
- PostgreSQL: `17.6`
- failed transaction partial objects: `0`
- rehearsal 1: pgTAP `55/55`, revision contention PASS
- Window A rollback: PASS, remaining Stage 2 relations `0`
- rehearsal 2: pgTAP `55/55`, revision contention PASS
- DB lint: PASS, `No schema errors found`
- app focused: `85/85`
- app full regression: `915/915`
- npm audit (production dependencies): `0 vulnerabilities`

pgTAP setup 중 Supabase가 소유한 `grant_pg_cron_access`, `grant_pg_net_access`에 대한 harmless grant warning 두 건이 각 rehearsal에서 출력됐으나 테스트·RLS·grant 검사·DB lint는 모두 PASS했다. 외부 provider 또는 Production 연결은 없었다.

## 도메인 불변식

- contract `DRAFT`/`SENT`에서 `WORK_READY` DENY
- `ACCEPTED`/`SIGNED`, 또는 `NOT_REQUIRED`에서 ALLOW
- confirmation은 payment를 `PAID`로 변경하지 않음
- revision bump는 row lock 기반 atomic next revision
- direct authenticated revision/payment/confirmation/consent/content mutation DENY
- publication은 exact current revision confirmation + channel consent + merchant approval + receipt 필요
- medical publication은 기본 DENY
- original evidence는 UPDATE/DELETE DENY이며 새 revision으로만 변경

## Media/provider 판정

foundation은 metadata와 object key integrity만 정의한다. Production object storage provider, Google Drive, payment, signature, SNS는 연결하지 않으며 activation default는 모두 `false`다.

## 현재 blocker

[Production schema evidence](./SERVICE_OS_PRODUCTION_SCHEMA_EVIDENCE.md)의 P0 live metadata가 아직 확인되지 않았다. isolated rehearsal 결과와 무관하게 exact project/PK/FK/auth mapping/collision/migration history가 모두 live-verified되기 전에는 Promotion PASS를 선언하지 않는다.
