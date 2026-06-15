# Feedback Record Read-Model

Status: Draft PR scope. This is Formbricks-style structure only for MyBiz internal customer reaction planning.

No Formbricks source code is copied. No external Formbricks Hub or feedback API is connected. No external survey, review, analytics, AI, message, mail, or notification API is called.

## Intent

MyBiz needs a safe way to organize customer reactions from inquiries, reviews, surveys, manual notes, and public-page signals into customer memory assets.

This PR adds a local/mock/read-only feedback record contract so store owners can see:

- sentiment
- category
- severity
- redacted summary
- safe tags
- aggregate follow-up counts

It does not persist production feedback records.

## Formbricks-Style Concepts Referenced

The design borrows only the product pattern:

- tenant-scoped feedback records
- feedback source attribution
- safe metadata separate from raw response text
- summary counts for dashboard/reporting

The implementation is MyBiz-native and uses existing dispatcher/read-model patterns.

## Data Contract

Feedback record fields:

- `feedbackId`
- `storeId`
- `customerId` optional
- `inquiryId` optional
- `surveyResponseId` optional
- `sourceType`: `inquiry`, `review`, `survey`, `manual_note`, `public_page`
- `sentiment`: `positive`, `neutral`, `negative`, `unknown`
- `category`: `complaint`, `praise`, `question`, `request`, `churn_risk`, `other`
- `redactedSummary`
- `tags`
- `severity`: `low`, `medium`, `high`
- `createdAt`
- `safeMetadata`

## Privacy Policy

Raw review text, raw message text, and customer PII must not be stored or returned from this read-model.

The read-model returns only:

- redacted summaries
- safe aggregate counts
- safe source/category metadata
- non-identifying tags

The safe metadata allowlist excludes raw message bodies, raw review text, customer identifiers, contact values, visitor identifiers, IP values, browser identifiers, and fingerprints.

## Store Isolation

All records are scoped by `storeId`.

The read-model filters inquiries, survey responses, timeline events, customers, and mock records to the requested store before building the response. Cross-store identifiers must not appear in the returned payload.

## Admin API

Existing dispatcher only:

- `GET /api/admin?resource=feedback-records&storeId=...`
- `GET /api/admin/feedback-records?storeId=...`
- `GET /api/admin/feedback-records/:feedbackId?storeId=...`
- `GET /api/admin?resource=feedback-summary&storeId=...`
- `GET /api/admin/feedback-summary?storeId=...`

No new Vercel serverless function file is added.

## Launch Gates

- `feedbackRecordReadModelEnabled=true`: read-model/mock interface can be shown.
- `liveFeedbackRecordWriteEnabled=false`: production persistence remains disabled.
- `broadDbWriteEnabled=false`: broad production DB writes remain blocked.

Production write routes are not implemented in this PR.

## Revenue Path

This supports PRO and VIP customer memory workflows:

- PRO: structured complaint/praise/question/request views for store owners
- VIP: follow-up prioritization and AI report inputs
- future: customer timeline enrichment after schema/RLS approval

## Next Approval-Gated Steps

Before launch persistence:

1. evidence PR for target feedback schema, RLS, grants, and store isolation
2. migration proposal review
3. explicit approval for persistence canary
4. write-gate enablement plan
5. rollback plan and production read-only smoke

## Forbidden In This PR

- Formbricks code copy
- external Formbricks Hub/API connection
- production DB write
- Supabase db push
- Supabase migration repair
- Supabase migration up/apply
- migration file addition
- SQL replay
- RLS policy apply
- GRANT/REVOKE
- live feedback record write
- live public page event write
- live background job execution
- live customer memory write
- live lead write
- live AI trace write
- env/auth/payment/webhook change
- visitor/customer/lead/feedback production row creation
- raw PII output
- raw review/message output
- customer notification sending
- Sales Excel import is out of scope

## Rollback

Revert this PR. Since there is no migration, no production write, no external API connection, and no serverless file expansion, rollback is source-only.
