# Customer Memory Store Catalog Selection

Status: `DRAFT_PR_SELECTION_PACKET_ONLY`

Branch: `codex/customer-memory-store-catalog-selection`

PR #123 state: `MERGED`

PR #123 baseline: customer-memory test-store canary plan merged.

PR #124 state: `MERGED`

PR #124 decision: `OWNER_STORE_NOT_FOUND`

main HEAD after PR #124: `8ed0ce0fa87f620080db461bd577522791e7a76c`

This packet prepares a sanitized production store catalog so the owner can choose exactly one canary test store. It is not a canary execution PR and does not approve any production write.

## PR #124 Baseline

PR #124 established the previous owner alias lookup result:

- owner alias lookup result: `OWNER_STORE_NOT_FOUND`
- production DB write: `false`
- live customer memory gate enablement: `false`
- production schema/env/auth/payment/webhook change: `false`
- raw PII output: `false`
- canary write after PR #124: `BLOCKED`

That baseline remains active. This packet only replaces the unresolved alias path with a six-candidate sanitized catalog for owner selection.

## Production Catalog Lookup

Production catalog lookup mode: `READ_ONLY_SANITIZED_STORES_CATALOG`

Lookup boundary:

- table: `public.stores`
- `SELECT *`: forbidden
- explicit column allowlist only
- allowlist columns used: `store_id`, `slug`, `name`, `brand_config`, `created_at`, `plan`
- total stores count: `6`
- catalog row count: `6`
- customer/contact/inquiry/timeline row samples: forbidden
- lead/visitor/payment/webhook row samples: forbidden
- raw PII output: forbidden
- raw customer names, phones, emails, or addresses: forbidden
- raw store IDs: forbidden in this packet
- API write call: forbidden
- test inquiry save: forbidden
- new store creation: forbidden

The live projection did not use `SELECT *`. Store IDs are internal operational identifiers; this packet uses candidate numbers plus hash-only `store_id_short` values so the owner can select a candidate without exposing full IDs.

## Sanitized Store Catalog

Candidate decision: `OWNER_SELECT_EXACTLY_ONE_CANDIDATE`

The owner must select one candidate number before any canary write can be considered.

| candidate_no | store_id_short | slug_masked | name_masked | business_type | status | created_at_date | updated_at_date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `sha256:10d7a0edeb9d` | `masked(len:5,hash:824d80d7)` | `masked(len:3,hash:42ca2ff0)` | `not exposed` | `not exposed in stores allowlist/schema` | `2026-02-15` | `not exposed by selected projection` |
| 2 | `sha256:76c555138b50` | `masked(len:4,hash:9f86d081)` | `masked(len:4,hash:94ee0593)` | `not exposed` | `not exposed in stores allowlist/schema` | `2026-02-26` | `not exposed by selected projection` |
| 3 | `sha256:23b0a2ed7f64` | `masked(len:12,hash:473ef9eb)` | `masked(len:3,hash:bc19d3b3)` | `not exposed` | `not exposed in stores allowlist/schema` | `2026-02-27` | `not exposed by selected projection` |
| 4 | `sha256:87c7e8457173` | `masked(len:12,hash:d9d73d23)` | `masked(len:3,hash:bc19d3b3)` | `not exposed` | `not exposed in stores allowlist/schema` | `2026-02-27` | `not exposed by selected projection` |
| 5 | `sha256:778add3a5a45` | `masked(len:11,hash:6437db62)` | `masked(len:3,hash:bc19d3b3)` | `not exposed` | `not exposed in stores allowlist/schema` | `2026-03-03` | `not exposed by selected projection` |
| 6 | `sha256:e4ca6943192a` | `masked(len:15,hash:997bc9ef)` | `masked(len:15,hash:b780677d)` | `masked/not rendered` | `not exposed in stores allowlist/schema` | `2026-03-12` | `not exposed by selected projection` |

Catalog notes:

- candidate numbers are the owner-facing selection handles
- hash values are only for internal correlation and must not be treated as public identifiers
- repeated `name_masked` hashes indicate multiple stores with the same masked name fingerprint
- store type/test/internal status is not confirmed by this packet
- owner selection required before the next approval packet

## Owner Selection Gate

owner selection required

exact-one-store requirement

canary write status: `BLOCKED_UNTIL_OWNER_SELECTS_ONE_CANDIDATE`

canary execution PR: `not this PR`

Required owner input:

- selected candidate no
- confirmation that the selected candidate is the intended canary test store
- confirmation that the selected candidate is safe for synthetic customer-memory canary rows

No canary write may proceed until the owner selects exactly one candidate number and that selection resolves to exactly one internal `store_id`.

## Stop Conditions

Stop before any canary write when any condition is true:

- owner does not select one candidate
- candidate count mismatch
- raw PII risk
- ambiguous selected store
- store type/test/internal status unclear
- Vercel protection blocks read-back
- selected candidate cannot be resolved to exactly one internal store ID
- requested payload includes a real customer name, phone, email, address, or row sample
- any write path outside the server customer-memory adapter is proposed
- cleanup is requested without separate approval

## Next Approval Packet

The next packet must be separate from this Draft PR and must include:

- selected candidate no
- resolved store_id confirmation
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`
- synthetic-only payload required
- write path: server customer-memory adapter path
- owner-approved scoped live gate posture
- pre-count and post-count checks for only the approved target tables

Expected DB effect after separate approval:

| Table | Maximum future approved effect |
| --- | --- |
| `customers` | `customers` upsert max 1 |
| `customer_contacts` | `customer_contacts` upsert max 1 |
| `inquiries` | `inquiries` insert max 1 |
| `customer_timeline_events` | `customer_timeline_events` insert max 1-2 |

Read-back after separate approval:

- customer card sanitized
- inquiry inbox redacted
- timeline non-PII summary
- wrong-store read-back must not return the marker
- cleanup requires separate approval

## Validation Checklist

Required before opening the Draft PR:

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-store-catalog-selection.test.ts`
- staged secret/PII scan
- Vercel preview checks

## Business Output

User problem solved:

- gives the owner a sanitized six-store catalog after the `방이동` alias did not resolve, without exposing raw store IDs or customer data

Revenue path supported:

- moves the PRO/VIP customer-memory canary toward a concrete owner-selected store while preserving the paid feature gate and avoiding unsafe writes

Data that can be collected after approval:

- selected candidate number, resolved store ID confirmation, synthetic marker evidence, bounded row-count deltas, sanitized customer card read-back, redacted inquiry inbox read-back, and non-PII timeline summary

Remaining before production launch:

- owner selects exactly one candidate
- selected candidate is confirmed as a test/demo/internal store
- separate canary execution approval is issued
- scoped live gate posture is confirmed
- one bounded synthetic write is executed through the server adapter
- read-back is sanitized
- cleanup or retained-audit-row decision is approved separately

## Side Effects

```json
{
  "production_db_write": false,
  "live_customer_memory_write": false,
  "live_customer_memory_gate_enabled": false,
  "live_lead_write": false,
  "live_lead_gate_enabled": false,
  "api_write_call": false,
  "test_inquiry_created": false,
  "new_store_created": false,
  "raw_pii_output": false,
  "customer_contact_inquiry_timeline_samples": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "migration_repair": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "external_notification_sent": false,
  "sales_excel_import_touched": false,
  "manual_deploy": false,
  "pr_106_merged": false,
  "store_catalog_selection_packet_created": true,
  "canary_write_blocked": true
}
```
