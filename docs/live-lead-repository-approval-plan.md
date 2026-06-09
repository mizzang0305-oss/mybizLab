# Live lead repository approval prep

Date: 2026-06-09

This is an approval-prep document for persisting owner-reviewed pilot leads. It is not a production migration approval, not an RLS apply approval, and not a live DB write approval.

## Goal

Prepare a safe path for MyBiz pilot application leads so FREE diagnosis, pricing, referral, or manual leads can later become owner-reviewed customer-memory seeds.

This supports:

- customer memory: lead context becomes the first merchant/customer-memory seed
- free acquisition: FREE CTA and diagnosis can feed owner review
- paid conversion: pilot-fit leads can become PRO/VIP candidates after owner review
- lock-in: operating pain, desired outcome, and memory readiness are captured before setup

## Current status

- Launch ON: `launchBetaEnabled`, `publicPricingEnabled`, `onboardingDiagnosisEnabled`, `ownerReviewedLeadCaptureEnabled`
- Approval-gated: `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, `liveLeadWriteEnabled`
- Live repository code exists, but it checks gates before any Supabase insert.
- Migration SQL is a draft under `supabase/migrations/20260609_lead_capture_requests.sql`.
- RLS policy draft is included in the migration file for review only.

## Canonical table draft

Table: `public.lead_capture_requests`

Key groups:

- ownership: `store_id`, `owner_profile_id`
- source/status: `source`, `status`
- sanitized merchant context: store name, business type, address summary, main concern, desired outcome
- protected contact fields: encrypted contact fields plus masked display fields
- customer memory seed: current customer management, reservation flow, inquiry flow, data readiness, pilot score, memory seed summary
- owner workflow: next action, owner note, archived status instead of delete
- consent: contact and marketing booleans

No raw browser storage, tokens, sessions, payment payloads, or customer PII examples are stored in docs or tests.

## RLS draft

Draft policy intent:

- Platform owner/admin can select/insert/update reviewed leads.
- Store members can select/update only rows with their `store_id`.
- No anonymous insert/select/update/delete policy.
- No delete policy; use `archived` status.
- No service-role policy shortcut.

The production RLS apply remains blocked until a separate owner approval confirms target project, rollback, and policy evidence.

## Repository boundary

`createSupabaseLeadCaptureRepository` maps a sanitized `LeadCaptureWriteDraft` to `lead_capture_requests`.

Before any `.insert(` call it requires:

1. `broadDbWriteEnabled`
2. `leadCapturePersistenceEnabled`
3. `liveLeadWriteEnabled`

If any gate is OFF, it returns:

```json
{
  "ok": false,
  "code": "LIVE_LEAD_WRITE_DISABLED",
  "approvalRequired": true
}
```

## Verification scope

The intended verification for this prep PR is local only:

- migration/RLS contract tests
- live repository gate tests
- launch gate tests
- typecheck/build/full Vitest
- optional local read-only smoke

No Supabase migration apply, RLS apply, live insert/update/delete, deploy, payment provider call, webhook mutation, auth/env change, customer notification, or external API mutation is included.

## Rollback plan

Before approval: revert the docs, tests, migration draft, launch gate keys, and repository file.

After future migration approval: use a separately reviewed down-migration or revert migration plan that removes policies first, then indexes/triggers/table only after confirming no production lead data must be retained.
