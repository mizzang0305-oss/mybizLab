# Lead capture grant remediation plan

Date: 2026-06-13

This document is a draft-only remediation plan for broad table grants on `public.lead_capture_requests`. It does not approve or execute `GRANT`, `REVOKE`, migration apply, RLS policy apply, live lead writes, customer memory writes, deploys, payment calls, webhook changes, auth/env changes, customer notifications, or external API mutations.

## A. Current problem

Read-only evidence shows RLS is enabled on `public.lead_capture_requests`, but table grants are broader than the target access posture:

- `anon` has `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES`.
- `authenticated` has `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES`.
- `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES` grants are hard blockers before migration apply, RLS apply, PR Ready transition, or live lead write enablement.

RLS policies still restrict row-level behavior, but broad table privileges increase the exposed-surface risk and do not match the owner-reviewed lead capture model.

## B. Target grant posture

- `anon`: no table privileges on `public.lead_capture_requests`.
- `public`: no table privileges on `public.lead_capture_requests`.
- `authenticated`: only the minimum privileges needed for RLS-governed owner/admin flows, currently `SELECT`, `INSERT`, and `UPDATE` as a candidate posture.
- `authenticated`: no `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES`.
- service role/admin operations remain server-side only and are not enabled by this document.

## C. Remediation SQL draft

Do not run this SQL without separate owner approval and a fresh production target confirmation.

```sql
-- DRAFT ONLY. DO NOT RUN WITHOUT APPROVAL.

revoke all privileges on table public.lead_capture_requests from anon;
revoke all privileges on table public.lead_capture_requests from public;

revoke delete, truncate, trigger, references
on table public.lead_capture_requests
from authenticated;

-- Keep only the minimum privileges needed for RLS-governed owner/admin flows.
-- This grant must be approved separately.
grant select, insert, update
on table public.lead_capture_requests
to authenticated;
```

## D. Pre-remediation checks

- Confirm no active public flow relies on `anon` table privileges.
- Confirm `leadCapturePersistenceEnabled` remains OFF.
- Confirm `liveLeadWriteEnabled` remains OFF.
- Confirm `broadDbWriteEnabled` remains OFF.
- Confirm row_count is still recorded as a number only.
- Confirm RLS policies still match the approved owner-reviewed lead capture flow.
- Confirm production smoke plan is ready before any approved grant remediation.

## E. Post-remediation evidence

Run read-only evidence only after an approved remediation:

- `anon` grants absent.
- `public` grants absent.
- `authenticated` `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES` absent.
- `authenticated` `SELECT`, `INSERT`, and `UPDATE` present only if separately approved.
- RLS remains enabled.
- Policy list remains unchanged or owner-approved.
- Delete policy remains absent.
- row_count does not change.
- `leadCapturePersistenceEnabled` remains OFF.
- `liveLeadWriteEnabled` remains OFF.
- production smoke passes.

## F. Blocked until approval

Until this plan is approved and verified:

- PR #100 remains Draft.
- migration apply remains BLOCKED.
- RLS policy apply remains BLOCKED.
- live lead write enable remains BLOCKED.
- live customer memory write remains BLOCKED.
