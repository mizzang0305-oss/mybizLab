# Customer-Memory Contact-Only Harness Mode

Status: `CONTACT_ONLY_HARNESS_MODE_READY_FOR_REVIEW`

Branch: `codex/customer-memory-contact-only-harness-mode`

This packet fixes the `BLOCKED_NO_CONTACT_ONLY_HARNESS_MODE` result from PR #136. It adds a contact-only dry-run/execute gate to the existing safe synthetic harness, but does not execute the contact retry.

No production DB write, canary retry, cleanup/delete, public API write route, schema change, RLS/GRANT/REVOKE, migration, db push, SQL replay, env/auth/payment/webhook change, manual deploy, or external notification was executed by this PR.

## Baseline

- PR #135 merged: contact policy fixed; adapter contact payload includes `store_id`; synthetic contact uses `contact_type=other`.
- PR #136 merged: approved contact-only retry was blocked with `BLOCKED_NO_CONTACT_ONLY_HARNESS_MODE`.
- PR #136 pre-counts: `customers 1`, `customer_contacts 0`, `inquiries 1`, `customer_timeline_events 1`.
- main baseline before this branch: `00d9ebd098667de037d804a9a11f54459e7a5182`.
- approved slug: `mybizlab-test`.
- marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`.

## Approval Gate

The harness now supports this approval string:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT
```

Required execute env for any future contact-only retry:

- `MYBIZ_CANARY_APPROVAL=APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT`
- `MYBIZ_CANARY_EXECUTE=true`
- `MYBIZ_CANARY_STORE_SLUG=mybizlab-test`
- `MYBIZ_CANARY_MARKER=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`

Dry-run behavior:

- if the contact approval is supplied without `MYBIZ_CANARY_EXECUTE=true`, the harness reports `contact_only_mode=true`.
- dry-run still performs no production write.
- dry-run output remains sanitized: no raw full `store_id`, raw PII, or row sample.

Verified dry-run evidence on this branch:

- command: `npm run customer-memory:canary:dry-run`
- env supplied: contact-only approval, approved slug, approved marker, no execute flag
- status: `DRY_RUN_READY_NO_WRITE`
- approval mode: `contact_only_non_pii_dry_run`
- contact-only mode: `true`
- execute requested: `false`
- production DB write: `false`
- selected store evidence: masked `960b40b6...a0ed`, hash `5f84c707e917f845`
- pre-counts: `customers 1`, `customer_contacts 0`, `inquiries 1`, `customer_timeline_events 1`
- non-target counts: `stores 1`, `store_members 0`, `store_subscriptions 0`, `store_public_pages 0`

Execute behavior for a future separately reviewed run:

- `contact_only_mode=true`
- calls `saveCustomerContact` only
- does not call `saveCustomer`
- does not call `saveInquiry`
- does not call `appendTimelineEvent`
- still uses the server adapter path only
- still forbids `/api/*` public write routes

## Pre-Count Guard

Contact-only execute requires the retained proof baseline:

| Table | Required pre-count |
| --- | ---: |
| `customers` | `1` |
| `customer_contacts` | `0` |
| `inquiries` | `1` |
| `customer_timeline_events` | `1` |

If any pre-count differs, the harness blocks before write with a contact-only baseline error.

After a future contact-only execute, the harness applies a contact-only row-effect guard:

- `customers` delta must be `+0`
- `customer_contacts` delta must be `+0` or `+1`, max `1`
- `inquiries` delta must be `+0`
- `customer_timeline_events` delta must be `+0`
- any violation blocks the run result with `CONTACT_ONLY_ROW_EFFECT_EXCEEDED`

## Allowed Future DB Effect

This PR does not execute the future write. The intended future cap is:

| Table | Allowed future delta |
| --- | ---: |
| `customers` | `+0` |
| `customer_contacts` | `+1 max` |
| `inquiries` | `+0` |
| `customer_timeline_events` | `+0` |
| `stores` | `+0` |
| `store_members` | `+0` |
| `store_subscriptions` | `+0` |
| `store_public_pages` | `+0` |

Non-target tables must remain unchanged.

## Non-PII Contact Policy

The contact-only retry keeps the PR #135 policy:

- `contact_type=other`
- `normalized_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- `raw_value=MYBIZ_CANARY_CUSTOMER_MEMORY_20260618`
- real customer name: forbidden
- real phone: forbidden
- real email: forbidden
- placeholder phone saved as real contact: forbidden
- placeholder email saved as real contact: forbidden

## Next Gate

Next required approval remains:

```text
APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT
```

This approval must be re-reviewed against this merged contact-only mode before any future execute. Cleanup/delete remains a separate approval.

## side_effects JSON

```json
{
  "production_db_write": false,
  "canary_retry_executed": false,
  "cleanup_executed": false,
  "contact_only_mode_added": true,
  "contact_only_execute_performed": false,
  "contact_only_dry_run_supported": true,
  "execute_requires_owner_approval": true,
  "safe_harness_used": true,
  "server_adapter_path_only": true,
  "public_api_write_call": false,
  "non_pii_contact_policy_used": true,
  "real_customer_name_used": false,
  "real_phone_used": false,
  "real_email_used": false,
  "placeholder_phone_saved_as_real_contact": false,
  "placeholder_email_saved_as_real_contact": false,
  "customer_row_created": false,
  "customer_contact_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "schema_changed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "rls_or_grant_executed": false,
  "live_customer_memory_gate_enabled": false,
  "raw_pii_output": false,
  "customer_row_sample_output": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "sales_excel_import_touched": false,
  "pr_106_merged": false,
  "pr_125_merged": false,
  "next_required_approval": "APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CONTACT_RETRY_WITH_NON_PII_CONTACT"
}
```
