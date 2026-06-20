# Customer-Memory Contact After-Dependency Approval Gate Alignment

Status: `CONTACT_AFTER_DEPENDENCY_APPROVAL_GATE_ALIGNMENT_READY_FOR_DRAFT_REVIEW`

Branch: `codex/customer-memory-contact-after-dependency-approval-gate-alignment`

This PR aligns the merged safe synthetic harness with the after-dependency-fix contact-only retry approval phrase. It is code/docs/tests-only and does not execute a contact-only retry.

No production DB write, contact-only retry, cleanup/delete, second retry, public API write route call, ad hoc harness creation, customer/contact/inquiry/timeline row creation, RLS/GRANT/REVOKE, migration, db push, SQL replay, env/auth/payment/webhook change, external notification/SMS/email/webhook call, sales Excel import, manual deploy, PR #106 merge, or PR #125 merge is performed by this PR.

## PR #141 Baseline

- PR #139 merged: blocked contact-only retry result evidence.
- PR #140 merged: harness dependency-scan loader fix.
- PR #141 merged: contact-only retry after dependency fix blocked by approval gate mismatch.
- PR #141 decision: `BLOCKED_CONTACT_ONLY_RETRY_APPROVAL_GATE_NOT_ALIGNED`.
- PR #141 root cause: the owner-provided after-dependency-fix approval phrase was rejected with `MYBIZ_CANARY_APPROVAL_REQUIRED`.
- PR #141 execute attempt count: `0`.
- PR #141 production DB write: `false`.
- PR #141 write deltas: `customers +0`, `customer_contacts +0`, `inquiries +0`, `customer_timeline_events +0`.
- PR #141 cleanup/delete: `false`.
- PR #141 second retry: `false`.
- PR #141 raw PII output: `false`.

## Root Cause

The merged harness preserved these approval phrases:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT
```

It did not accept the separate after-dependency-fix contact-only approval phrase:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX
```

As a result, PR #141 correctly stopped at the approval gate before dry-run, pre-count read, execute, post-count read, or sanitized read-back.

## Fix Summary

The harness now registers the after-dependency-fix phrase as a contact-only retry approval gate:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX
```

The new gate maps to contact-only mode and retains the same baseline and row-effect protections as the existing non-PII contact retry gate.

Existing approval phrases remain present:

- `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY`
- `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER`
- `APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT`

## Preserved Gates

Execute still requires all four exact conditions:

- `MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX`
- `MYBIZ_CANARY_EXECUTE=true`
- `MYBIZ_CANARY_STORE_SLUG=mybizlab-test`
- `MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

The harness still blocks:

- `MYBIZ_CANARY_EXECUTE=true` without an accepted approval phrase
- approval mismatch
- slug mismatch
- marker mismatch

Dry-run default is preserved:

- no execute flag means `execute=false`
- after-dependency-fix approval without execute reports contact-only dry-run mode
- dry-run returns `DRY_RUN_READY_NO_WRITE`
- production DB write remains `false`

Verified dry-run evidence on this branch:

- command: `npm run customer-memory:canary:dry-run`
- env supplied: after-dependency-fix approval, approved slug, approved marker, no execute flag
- status: `DRY_RUN_READY_NO_WRITE`
- approval mode: `contact_only_non_pii_dry_run`
- contact-only mode: `true`
- execute requested: `false`
- production DB write: `false`
- selected store evidence: masked `960b40b6...a0ed`, hash `5f84c707e917f845`
- pre-counts: `customers 1`, `customer_contacts 0`, `inquiries 1`, `customer_timeline_events 1`
- non-target counts: `stores 1`, `store_members 0`, `store_subscriptions 0`, `store_public_pages 0`

Contact-only behavior is preserved:

- contact-only execute path calls `saveCustomerContact` only
- it does not call `saveCustomer`
- it does not call `saveInquiry`
- it does not call `appendTimelineEvent`
- public `/api/*` write routes are not used
- server adapter path remains the approved adapter path
- raw PII and raw row samples remain forbidden

## Not Executed In This PR

- production DB write: `false`
- contact-only retry executed: `false`
- cleanup/delete: `false`
- second retry: `false`
- customer/contact/inquiry/timeline row creation: `false`
- PR #106 merge: `false`
- PR #125 merge: `false`

## Next Required Approval

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX
```

A future contact-only retry still requires a separate owner-approved execution request. Cleanup/delete and live gate enablement remain separate approvals.

## side_effects JSON

```json
{
  "production_db_write": false,
  "contact_only_retry_executed": false,
  "cleanup_executed": false,
  "after_dependency_fix_approval_gate_aligned": true,
  "initial_approval_gates_preserved": true,
  "dry_run_default": true,
  "execute_requires_owner_approval": true,
  "execute_requires_slug": true,
  "execute_requires_marker": true,
  "approved_store_slug": "mybizlab-test",
  "synthetic_marker": "MYBIZ_CANARY_CUSTOMER_MEMORY_20260618",
  "public_api_write_call": false,
  "ad_hoc_harness_created": false,
  "customer_row_created": false,
  "customer_contact_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "external_notification_sent": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "next_required_approval": "APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT_AFTER_DEPENDENCY_FIX"
}
```
