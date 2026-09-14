---
type: apply-runbook
project: MyBiz
status: draft-not-authorized
updated: 2026-09-14
tags: [mybiz, service-os, supabase, owner-gate]
---

# Service OS Production Apply Runbook

이 문서는 향후 Owner 승인용 준비 문서다. 이번 R1에서는 어떤 Production 명령도 실행하지 않는다.

## Gate 0 — target과 backup

- exact MyBiz Supabase project ref를 Owner가 승인한다.
- read-only metadata inventory 결과가 foundation의 preflight와 일치한다.
- migration history와 collision이 `0` 또는 명시적으로 검토 완료다.
- point-in-time recovery/backup 상태와 복구 담당자를 확인한다.
- 현재 Production deployment와 rollback target을 기록한다.

## Gate 1 — foundation only

- 승인 대상 파일 SHA-256을 고정한다.
- `20260914005630_mybiz_service_os_foundation.sql`만 적용한다.
- 적용 직후 11개 table의 RLS enabled/forced, 정책, grants, private function privileges를 조회한다.
- authenticated INSERT가 계속 DENY인지 확인한다.
- 앱의 모든 Service OS activation 값은 `false`로 유지한다.

## Gate 2 — application adapter

- schema binding은 서버측 feature gate로 시작한다.
- confirmation, payment, publication adapter는 각각 별도 gate를 유지한다.
- object storage provider와 Google Drive는 연결하지 않는다.
- synthetic tenant로 smoke하되 실제 고객 데이터를 사용하지 않는다.

## Gate 3 — browser write activation, 별도 승인

- `profiles.id → auth.users.id` FK를 live catalog에서 재증명한다.
- foundation runtime certification과 adapter authorization review가 PASS여야 한다.
- 별도 migration SHA와 rollback forward migration을 고정한다.
- `20260914005632_mybiz_service_os_live_write_activation.sql`만 별도 승인 창에서 검토한다.

## 즉시 중단 조건

- target/ref/SHA 불일치
- required PK/FK/function 불일치
- unexpected relation, function, policy collision
- migration history 불일치
- authenticated grant 확대 또는 RLS 미적용
- 실제 고객 행/외부 provider가 필요해지는 경우
