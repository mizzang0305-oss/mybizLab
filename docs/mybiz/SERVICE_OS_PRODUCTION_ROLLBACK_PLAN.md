---
type: rollback-plan
project: MyBiz
status: draft-owner-gate
updated: 2026-09-14
tags: [mybiz, service-os, rollback, supabase]
---

# Service OS Production Rollback Plan

## 공통 원칙

- Production apply 전 별도 Owner 승인과 exact target identity가 필요하다.
- 자동 `db reset`, remote migration repair, schema dump 복원은 사용하지 않는다.
- binary object는 DB transaction rollback 대상이 아니므로 provider binding은 계속 비활성이다.
- 브라우저 write activation은 foundation과 별도 변경 창으로 취급한다.

## Window A — foundation 적용 직후, 사용자 write 전

전제: Stage 2의 11개 테이블이 모두 비어 있음을 먼저 증명한다. 한 테이블이라도 행이 있으면 destructive down을 중단한다.

역순:

1. portfolio/content triggers 제거
2. job revision trigger 제거
3. Stage 2 전용 private functions 제거
4. 기존에 없었던 빈 `private` schema 제거
5. `vertical_templates`
6. `brand_site_portfolio_items`
7. `brand_sites`
8. `content_candidates`
9. `job_payment_requests`
10. `consent_records`
11. `job_confirmation_links`
12. `job_confirmations`
13. `job_evidence_assets`
14. `job_evidence_revisions`
15. `service_jobs`

격리 rehearsal용 정확한 SQL은 [foundation down fixture](../../supabase/tests/fixtures/mybiz_service_os_foundation_down.sql)에 있다. 이 파일은 Production 자동 실행 스크립트가 아니다.

## Window B — 데이터/write 발생 후

테이블 drop을 기본 rollback으로 사용하지 않는다.

1. 앱의 Service OS write, confirmation, payment, publication gate를 모두 `false`로 전환
2. browser write activation의 INSERT grant/policy를 별도 승인된 forward migration으로 제거
3. 기존 행과 object keys를 보존하고 mutation을 중단
4. catalog, RLS, grants, error logs를 sanitized evidence로 수집
5. 원인별 forward-fix migration을 새 번호로 작성하고 별도 rehearsal/Owner Gate 수행

## 복구 검증

- customer/merchant traffic이 Stage 2 write surface에 도달하지 않음
- 기존 non-Stage2 route와 certified Production homepage 정상
- Stage 2 데이터 row count와 object reference 보존
- payment/signature/SNS provider 호출 `0`
