# Service OS Schema Alignment

## Scope and safety

검토 대상은 draft `supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql`이다. 이 migration은 exact-head ephemeral CI에서 pgTAP 25/25를 통과했지만 Production에 적용되거나 active migration으로 승격되지 않았다.

`PRODUCTION_DB_APPLIED=false`

`MIGRATION_PROMOTED=false`

`REMOTE_SQL_EXECUTION=0`

## Entity classification

| Entity | Primary classification | Secondary review | Reason |
| --- | --- | --- | --- |
| `service_jobs` | NEEDS_MIGRATION | READY | canonical Job/contract/payment state와 tenant FK가 draft에 존재 |
| `job_evidence_assets` | NEEDS_MIGRATION | READY | object key, SHA-256, revision metadata와 member insert 정책 존재 |
| `job_evidence_revisions` | NEEDS_MIGRATION | NEEDS_RLS_REVIEW | atomic bump 함수와 direct client insert deny를 Production promotion 전에 재검토 |
| `job_confirmations` | NEEDS_MIGRATION | NEEDS_RLS_REVIEW | revision-bound 확인; 직접 client mutation 제한 |
| `job_confirmation_links` | NEEDS_MIGRATION | NEEDS_RLS_REVIEW | token hash client read 차단과 secure consume 함수 유지 필요 |
| `consent_records` | NEEDS_MIGRATION | NEEDS_RLS_REVIEW | 채널·revision별 동의와 direct client mutation 제한 |
| `job_payment_requests` | NEEDS_MIGRATION | NEEDS_ADAPTER | 상태 추적 스키마는 준비, 실제 merchant payment provider는 미연결 |
| `content_candidates` | NEEDS_MIGRATION | NEEDS_ADAPTER | terminal mutation은 service role; 실제 publish receipt adapter 미연결 |
| `brand_sites` | NEEDS_MIGRATION | READY | tenant별 브랜드 사이트 메타데이터 |
| `brand_site_portfolio_items` | NEEDS_MIGRATION | NEEDS_RLS_REVIEW | 정확한 revision·content candidate 관계와 게시 eligibility 검토 |
| `vertical_templates` | NEEDS_MIGRATION | LEGACY_COMPATIBILITY | 하나의 엔진용 template, medical 기본 비공개 |

모든 엔티티는 `BLOCKED_PRODUCTION_APPLY` 상태다. Draft에서 active migration으로 옮기는 행위, Production 연결, remote SQL은 별도 Owner Gate다.

## Adapter status

- Domain `ObjectStorageAdapter`: interface READY
- Local adapter: original/derived namespace, traversal guard, integrity receipt, original delete prohibition 구현
- Cloudflare R2 primary candidate: NEEDS_OWNER_DECISION, not bound
- B2/GCS disaster copy: NEEDS_OWNER_DECISION, not bound
- Google Drive merchant export/sync: NEEDS_ADAPTER, not connected; canonical primary storage가 아님
