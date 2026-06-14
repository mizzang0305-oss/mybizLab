# Lead capture grant remediation plan

Date: 2026-06-13

This document records the approved grant remediation result for broad table grants on `public.lead_capture_requests`. It does not approve additional `GRANT`, `REVOKE`, migration apply, RLS policy apply, live lead writes, customer memory writes, deploys, payment calls, webhook changes, auth/env changes, customer notifications, or external API mutations.

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

## C. Approved remediation SQL executed

The following remediation was separately approved and executed on 2026-06-13. Do not run it again without fresh owner approval and target confirmation.

Before remediation:

- `anon`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`.
- `authenticated`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`.
- `public`: no returned grants.

After remediation:

- `anon`: no returned grants.
- `public`: no returned grants.
- `authenticated`: `SELECT`, `INSERT`, `UPDATE` only.
- `DELETE`, `TRUNCATE`, `TRIGGER`, and `REFERENCES` removed.
- row_count before and after: `0`.
- RLS enabled: `true`.
- delete policy count: `0`.
- no row data changed.
- DB permission change: `true`.
- grant_or_revoke_executed: `true`.

```sql
revoke all privileges on table public.lead_capture_requests from anon;
revoke all privileges on table public.lead_capture_requests from public;
revoke all privileges on table public.lead_capture_requests from authenticated;

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

## F. Remaining approval gates

The broad grant blocker is resolved, but these gates remain closed:

- PR #100 remains Draft until owner approves Ready conversion.
- migration apply remains BLOCKED until owner approval and migration strategy review.
- RLS policy apply remains BLOCKED until owner approval and auth-mapping review.
- live lead write enable remains BLOCKED until separate owner approval.
- live customer memory write remains BLOCKED until separate owner approval.
