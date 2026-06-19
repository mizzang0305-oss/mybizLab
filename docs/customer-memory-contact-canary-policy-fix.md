# Customer-Memory Contact Canary Policy Fix

Status: `CONTACT_CANARY_POLICY_FIX_READY_FOR_DRAFT_REVIEW`

Branch: `codex/customer-memory-contact-canary-policy-fix`

This packet investigates the PR #134 synthetic canary result where the inquiry and timeline paths were proven but the contact path was not created. It also adds the narrow adapter and harness policy fix needed before any separate owner-approved contact retry.

No canary retry, cleanup/delete, production DB write, public API write route, schema change, RLS/GRANT/REVOKE, migration, db push, SQL replay, env/auth/payment/webhook change, manual deploy, or external notification was executed by this PR.

## PR #134 Baseline

- PR #134 decision: `SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_PARTIAL_CONTACT_NOT_CREATED`
- retry executed exactly once in PR #134: `true`
- cleanup/delete in PR #134: `false`
- second retry in PR #134: `false`
- raw PII output in PR #134: `false`
- customer row sample output in PR #134: `false`

Actual PR #134 target deltas:

| Table | Delta |
| --- | ---: |
| `customers` | `+0` |
| `customer_contacts` | `+0` |
| `inquiries` | `+1` |
| `customer_timeline_events` | `+1` |

Interpretation:

- inquiry path proven: `true`
- timeline path proven: `true`
- contact path proven: `false`
- non-target table changed: `false`

## Live Contact Schema Evidence

Read-only metadata source: Supabase PostgREST OpenAPI schema.

Evidence type:

- schema metadata only
- no data rows
- no customer/contact/inquiry/timeline row samples
- no raw PII
- no `SELECT *`
- no SQL replay

Live `customer_contacts` metadata:

| Field | Evidence |
| --- | --- |
| `id` | primary key |
| `customer_id` | foreign key to `customers.customer_id` |
| `store_id` | present |
| `contact_type` | present |
| `normalized_value` | present |
| `raw_value` | present |
| `is_primary` | present |
| `is_verified` | present |
| `created_at` | present |

Local schema alignment evidence:

- store-scoped uniqueness exists only for `contact_type = 'phone'` and `contact_type = 'email'`.
- there is no observed enum restriction in the OpenAPI metadata.
- non-PII canary contact can therefore use `contact_type = 'other'` so it does not masquerade as a real phone or email contact.

## Root Cause

Primary root cause:

- `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts` built the `customer_contacts` write payload without `store_id`.
- The live contact schema and RLS/store-scope design require contact rows to carry the same `store_id` as the linked customer.
- PR #134 proved the linked customer, inquiry, and timeline paths, but the contact persistence path was not proven.

Policy root cause:

- `scripts/customer-memory/synthetic-canary-harness.mjs` represented the synthetic contact as `type: 'email'` with an `example.invalid` value.
- That is synthetic, but it still exercises the real email channel path and can be confused with a real contact route.
- Contact retry evidence must prove contact persistence without saving a real phone/email or a placeholder phone/email as a real contact.

## Fix Summary

Adapter fix:

- `toContactPayload` now includes `store_id: contact.store_id`.
- The adapter still writes through `src/server/mybiz/repositories/customerMemoryProductionAdapter.ts` only.
- The adapter still performs customer/store ownership validation before `customer_contacts` upsert.
- No `SELECT *` was added.
- No logging of raw contact values was added.

Harness policy fix:

- `SYNTHETIC_CONTACT_POLICY.contactType` is fixed to `other`.
- `SYNTHETIC_CONTACT_POLICY.normalizedValue` is fixed to `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`.
- `SYNTHETIC_CONTACT_POLICY.rawValue` is fixed to `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`.
- `OMITTED_NOT_REAL_NUMBER` is not saved as a phone contact.
- `OMITTED_NOT_REAL_EMAIL` is not saved as an email contact.
- The contact policy rejects `phone`, `email`, `@`, and phone-like contact values for the canary contact payload.

## Retry Gate

Retry status in this PR: `BLOCKED_PENDING_FRESH_OWNER_APPROVAL`

This PR does not run the harness and does not retry the canary.

Next required owner approval:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT
```

Expected retry scope after separate approval:

- approved store slug: `mybizlab-test`
- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- contact type: `other`
- contact normalized value: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- customers delta: `+0 or +1`, max `1`
- customer_contacts delta: upsert max `1`
- inquiries delta: insert max `1` only if separately approved by that retry packet
- customer_timeline_events delta: insert max `1~2` only if separately approved by that retry packet
- cleanup/delete: `false`
- second retry: `false`

## Validation

Expected validation before Ready review:

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-contact-canary-policy-fix.test.ts`
- staged sensitive-data/PII/full-UUID scan
- Vercel preview checks

## side_effects JSON

```json
{
  "production_db_write": false,
  "canary_retry_executed": false,
  "cleanup_executed": false,
  "contact_policy_fixed": true,
  "non_pii_contact_policy": true,
  "real_phone_used": false,
  "real_email_used": false,
  "placeholder_phone_saved_as_real_contact": false,
  "placeholder_email_saved_as_real_contact": false,
  "schema_changed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_gate_enabled": false,
  "public_api_write_call": false,
  "customer_row_created": false,
  "customer_contact_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "retry_requires_fresh_owner_approval": true
}
```
