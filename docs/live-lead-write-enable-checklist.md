# Live lead write enable checklist

Date: 2026-06-13

This checklist gates enabling live persistence for owner-reviewed lead capture. It is separate from migration apply and RLS policy apply. Do not enable live writes from this document.

## Required approvals

Live lead writes can be enabled only after all items are true:

- `lead_capture_requests` migration applied and verified.
- RLS policies applied and verified.
- Existing `lead_capture_requests` table path is resolved and no longer classified as `blocked_existing_data_or_policy_risk`.
- Broad grant blocker is resolved with read-only post-remediation evidence. 2026-06-13 evidence shows `anon` and `public` have no returned grants, `authenticated` has `SELECT`/`INSERT`/`UPDATE` only, row_count stayed `0`, RLS stayed enabled, and delete policy count stayed `0`.
- Required canonical columns are verified as `NOT NULL` after the existing-table path: `source`, `status`, `store_name`, `business_type`, `main_concern`, `desired_outcome`, `data_readiness`, `consent_marketing`, `consent_contact`, `created_at`, and `updated_at`.
- `CHECK ... NOT VALID` is not used as a substitute for required-field nullability.
- `anon` and `public` have no table privileges on `public.lead_capture_requests`.
- `authenticated` has no `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES` privileges on `public.lead_capture_requests`.
- `profiles.id = auth.uid()` is confirmed, or RLS policies are revised to use the approved auth-user mapping.
- Policy evidence passes:
  - platform admin select/insert/update exists.
  - store member select/update exists.
  - anon select/update/delete absent.
  - delete policy absent.
- Row count and retention policy are documented.
- PII storage policy is approved for encrypted and masked contact fields.
- Owner review workflow is approved.
- Test-only safe payload smoke is approved.
- `leadCapturePersistenceEnabled` change is approved.
- `liveLeadWriteEnabled` change is approved.
- `broadDbWriteEnabled` scope is approved and limited.
- Production smoke plan is approved.

## Forbidden bundles

Do not combine live lead write enablement with:

- migration apply
- RLS policy apply
- customer notification enablement
- payment checkout enablement
- webhook changes
- auth/env changes
- customer memory live writes
- external API mutation
- production deploy without explicit approval

## Enable sequence

1. Verify migration and RLS evidence.
2. Verify required canonical column nullability evidence.
3. Verify repository gate order still blocks insert before all gates are ON.
4. Approve a test-only safe payload that contains no raw customer PII.
5. Enable the narrowest required gate set.
6. Run one approved write smoke only if owner explicitly approves DB write.
7. Verify owner review console can see the lead through approved access.
8. Turn off gates immediately if any policy or data issue is detected.

## Required post-enable evidence

Record only sanitized evidence:

- timestamp
- branch/commit or config change reference
- gate values
- test-only lead id if allowed
- row count delta
- policy names
- production smoke PASS/BLOCKED
- rollback decision

Do not record raw contact details, browser storage, cookies, sessions, tokens, payment data, or private customer context.

## Default state

Until a separate approval explicitly changes the gates:

```json
{
  "leadCapturePersistenceEnabled": false,
  "liveLeadWriteEnabled": false,
  "live_lead_write": false
}
```
