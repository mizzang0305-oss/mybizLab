# MyBiz Stage 2 Product Contract

> 이 문서는 Stage 2 실행 계약입니다. 제품 전체의 canonical source of truth는
> [`mybiz/CANONICAL_PRODUCT.md`](mybiz/CANONICAL_PRODUCT.md)이며, 모듈·상업 분류·legacy 정책은
> [`mybiz/MODULE_CATALOG.md`](mybiz/MODULE_CATALOG.md),
> [`mybiz/COMMERCIAL_TAXONOMY.md`](mybiz/COMMERCIAL_TAXONOMY.md),
> [`mybiz/LEGACY_CAPABILITY_MAP.md`](mybiz/LEGACY_CAPABILITY_MAP.md)를 따릅니다.

## Product identity

MyBizLab is the company brand. MyBiz is its subscription product: a **Business Service OS** for service work with observable before/after or completion evidence.

Core promise: **작업부터 다음 고객까지.**

`Job → optional contract → evidence → customer confirmation → payment tracking → evidence package → channel-specific consent → merchant approval → brand/content candidate`

## Target customer and V1

- Public V1: cleaning, hair, installation/repair.
- Expansion templates: wig and interior/construction.
- Medical/regulated mode: modeled but `medical_vertical_enabled=false` by default and excluded from public V1.
- The core model is shared; vertical-specific fields live in template configuration rather than forked schemas.

## Job state contract

```text
requiresContract=false: JOB_CREATED → WORK_READY
requiresContract=true:  JOB_CREATED → CONTRACT_REQUIRED → SENT → ACCEPTED|SIGNED → WORK_READY
WORK_READY → WORK_IN_PROGRESS → WORK_COMPLETED
WORK_COMPLETED → CUSTOMER_CONFIRMED | CUSTOMER_CORRECTION_REQUESTED
new evidence revision after confirmation → CONFIRMATION_OUTDATED
```

Existing contract CRUD is a reusable “계약/동의서 관리” foundation, not a certified legal e-signature system. Provider verification remains outside V1.

## Evidence and revision

- Binary media belongs in object storage, never directly in business tables.
- `original/`, `derived/thumbnail/`, and `derived/content/` are separate namespaces.
- An original asset is append-only. Correction creates a new revision instead of overwriting bytes.
- SHA-256 is an integrity/change-detection basis only; it does not establish truth or automatic legal admissibility.
- Each confirmation remains bound to the exact job and evidence revision it observed.

## Customer confirmation link

- Production design: high-entropy token, server-side token hash, expiry, revocation, job scope, revision binding and audit.
- Database primary keys are not public-link credentials.
- Browser routes never receive or query stored token hashes.
- Current implementation is a clearly labeled synthetic route. Production issuance and mutation endpoints are not enabled.

## Consent separation

The following are independent records:

1. completion confirmation;
2. privacy processing basis;
3. marketing use;
4. website portfolio;
5. blog;
6. social channels;
7. regulated/medical advertising approval.

Withdrawal prevents future publication eligibility and must trigger projection review. It does not silently destroy original business evidence retained under a separate lawful retention policy.

## Payment boundary

- Merchant → MyBizLab: existing SaaS subscription billing, unchanged.
- End customer → merchant: Stage 2 `job_payment_requests` tracking domain.
- `CUSTOMER_CONFIRMED` never sets `PAYMENT_PAID`.
- Without a verified service-payment provider and settlement contract, UI stops at manual request/tracking and never simulates provider-paid success.

## Brand website strategy

- MyBiz/MyBizLab product brand surface and each merchant’s brand site are separate experiences.
- Customer sites use one multi-tenant engine under collision-safe `/site/:slug` previews, not per-customer codebases.
- Tiers: Basic, Brand, Growth. Unregistered commercial options show factual states such as 선택 옵션, 준비 중, or 도입 상담.
- A portfolio item requires exact-revision confirmation, channel-specific consent and merchant approval.

## Content pipeline

```text
DRAFT → GENERATED → REVIEW_REQUIRED → APPROVED → PUBLISH_READY → PUBLISHED
```

Rule/template drafts can run without an external AI provider. `PUBLISHED` requires a real provider receipt; current V1 does not execute external publication.

## Storage contract

`ObjectStorageAdapter` owns byte persistence, signed upload/read URL creation, derived-object deletion, metadata and SHA-256 receipts. The R2 local adapter writes real bytes under a caller-supplied private root, creates one-time short-lived capabilities, rejects filename-controlled paths, MIME/size violations and overwrite collisions, and re-reads bytes when verifying a receipt. It is dev/local only: it neither proves store membership nor binds a Production provider or public bucket.

The verified receipt flow is `UPLOAD_INTENT → SIGNED_UPLOAD → OBJECT_EXISTS → SERVER_METADATA_VERIFY → HASH_VERIFY → EVIDENCE_RECORDED`. An upload URL alone is never evidence success.

## Security contract

- Every row is `store_id` scoped and checked through store membership.
- Stage 2 tables use RLS plus explicit grants/revokes; token hashes are service-role-only.
- Evidence clients receive insert/select, not update/delete, preserving append-only originals.
- MIME/size checks, signed URLs, rate limiting and public mutation endpoints remain required before production provider enablement.
- No service-role credential, customer PII or raw sensitive payload belongs in browser code or analytics.

## Scope delivered in this branch

- Pure TypeScript domain policies and tests.
- Interactive product homepage.
- In-memory Service OS vertical slice with provider-disabled evidence upload.
- Synthetic customer confirmation route.
- Multi-tenant brand site previews with publication eligibility empty state.
- Approval-first content candidate demonstration.
- Additive Supabase schema review draft under `supabase/migration_drafts/`; excluded from the active migration set and not applied.

## Explicit non-scope / Owner Gates

Production deployment, main merge, Production DB migration, real payment product/price changes, signature-provider claims, external social publishing, custom-domain purchase, paid provider creation, legal terms finalization and medical publication enablement.
