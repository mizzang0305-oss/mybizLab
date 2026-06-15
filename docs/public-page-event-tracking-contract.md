# Public Page Event Tracking Contract

## 0. Intent

This is an Umami/PostHog-style structure only proposal and implementation slice for MyBiz public pages. It gives merchants a safe, store-scoped funnel read-model for public page views, CTA clicks, inquiry starts/submits, reservation clicks, and waiting clicks.

No Umami or PostHog source code is copied. No external analytics server is connected. No production analytics SDK is inserted.

## 1. Current Scope

- Read-only mock/local contract for public page funnel metrics.
- Existing `api/public.ts` and `api/admin.ts` dispatchers only.
- No new Vercel serverless function file.
- No production event persistence.
- No schema, migration, RLS, or grant change.
- Sales Excel import is out of scope.

## 2. Event Contract

Supported event types:

- `public_page_view`
- `cta_click`
- `inquiry_started`
- `inquiry_submitted`
- `reservation_clicked`
- `waiting_clicked`

Each event is store-scoped and carries only safe read-model fields: event id, store id, public page id, event type, conversion target, source path, redacted visitor session id, referrer domain, device type, occurred time, and safe metadata.

## 3. Privacy and Safe Metadata

IP, user-agent, and fingerprint values must not be stored. Raw name, phone, email, message, address, or customer identifiers must not be returned in public page event payloads.

Allowed safe metadata keys:

- `buttonId`
- `campaign`
- `ctaLabel`
- `elementRole`
- `source`
- `variant`

Metadata values are normalized and redacted before returning. The read-model is designed for aggregate funnel review, not visitor-level inspection.

## 4. Store Isolation

Every read-model request must include a `storeId`. Admin requests must pass store membership guard before returning the read-model. Public preview requests return only deterministic mock records for the requested store. The read-model filters out any event where `event.storeId !== requestedStoreId`.

## 5. FREE to PRO Funnel

FREE merchants can see that public page funnel tracking exists as a mock/read-only preview. PRO merchants can use the future approved live version to measure CTA conversion, inquiry completion, reservation intent, and waiting-list demand. VIP merchants can combine this event contract with daily summary jobs and AI trace review after separate approvals.

## 6. Feature Gates

- `publicPageEventTrackingEnabled=true`: enables mock/read-only contract.
- `livePublicPageEventWriteEnabled=false`: blocks live event persistence.
- `broadDbWriteEnabled=false`: blocks broad production DB writes.

The write decision remains blocked unless all required approval gates are explicitly enabled in a later approved change.

## 7. Forbidden Commands and Side Effects

Do not run:

- `npx supabase db push`
- `npx supabase migration repair`
- `npx supabase migration up`
- SQL replay
- RLS policy apply
- `GRANT` or `REVOKE`
- external analytics SDK installation
- external analytics server connection
- live public page event write

Do not create production visitor, customer, lead, inquiry, or event rows from this PR.

## 8. API and UI Contract

Public read-only preview:

- `GET /api/public?resource=public-page-events/preview&storeId=...`
- `GET /api/public/public-page-events/preview?storeId=...`

Admin read-only view:

- `GET /api/admin?resource=public-page-events&storeId=...`
- `GET /api/admin/public-page-events?storeId=...`
- `GET /api/admin/public-page-funnel?storeId=...`

The Brand/Public Page settings screen shows a mock/read-only funnel panel. Tracking activation controls remain disabled.

## 9. Launch Gate Criteria

Before live launch:

- schema proposal approved
- RLS and grant evidence approved
- event retention policy approved
- IP/user-agent/fingerprint exclusion verified
- store membership authorization verified
- canary approval granted
- production write gate explicitly approved

## 10. Rollback

Revert the PR commit. Because no migration, DB write, external analytics connection, SDK insertion, or live event persistence is included, rollback is source-only.
