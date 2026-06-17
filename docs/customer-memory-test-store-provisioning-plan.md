# Customer Memory Test-Store Provisioning Approval Plan

Status: `DRAFT_PR_APPROVAL_PACKET_ONLY`

Branch: `codex/customer-memory-test-store-provisioning-plan`

origin/main HEAD: `8ed0ce0fa87f620080db461bd577522791e7a76c`

This approval packet documents a future owner-gated production test-store provisioning plan. It does not create a store, write to the production database, enable live customer-memory gates, call any write API, save a test inquiry, or change env/auth/payment/webhook configuration.

## Current Baseline

- PR #123 state: `MERGED`
- PR #124 state: `MERGED`
- PR #124 decision: `OWNER_STORE_NOT_FOUND`
- PR #125 state: `OPEN_DRAFT_PASS`
- PR #125 decision: `OWNER_SELECT_EXACTLY_ONE_CANDIDATE`
- owner selected candidate no: `none`
- PR #125 catalog result: six existing production stores were sanitized, but no exact owner-selected candidate is approved for canary use
- canary write remains `BLOCKED`

## Owner Decision

Provisioning decision: `DEDICATED_TEST_STORE_APPROVAL_REQUIRED`

The owner direction is to create a dedicated test store instead of using one of the existing six production stores. This PR only creates the approval packet for that decision. Store provisioning execution remains out of scope and requires a later explicit approval.

## Proposed Test Store

- display alias: `마이비즈랩 테스트 스토어`
- slug candidate: `mybizlab-test`
- store_id: `DB-generated or schema-compliant identifier only`
- do not directly set `store_id` to `마이비즈랩`
- provisioning is `approval-gated`

The slug candidate is intentionally simple and non-customer-specific. If repo or schema rules require a safer variant, the future execution packet must document the final slug before any write.

## Live Schema Check

Lookup result: `PASS_READ_ONLY_SANITIZED`

- production `public.stores` read-only only
- mode: REST GET with configured production env key; credential values were not printed or committed
- explicit allowlist only
- projection used: `store_id,slug,plan,created_at`
- `SELECT *`: forbidden
- store identifier column: `store_id`
- current total stores count: `6`
- slug candidate conflict count: `0`
- customer/contact/inquiry/timeline/lead/payment table access: `forbidden`
- customer/contact/inquiry/timeline/lead/payment row sample output: `forbidden`
- raw PII output: `forbidden`
- raw production store names and raw production store slugs in committed files: `forbidden`

This lookup was read-only evidence for planning. It is not approval to insert, update, delete, replay SQL, run a migration, enable a gate, or call provisioning APIs.

## Future Approved Provisioning Scope

Expected DB effect for a later separately approved provisioning run:

| Table | Maximum approved future effect |
| --- | --- |
| `stores` | `stores` insert max 1 |
| `store_members` | `store_members` insert max 1 if required |
| `store_subscriptions` | `store_subscriptions` insert max 1 if required |
| `store_public_pages` | `store_public_pages` insert max 1 if required |
| `customers` | `customers` insert 0 |
| `customer_contacts` | `customer_contacts` insert 0 |
| `inquiries` | `inquiries` insert 0 |
| `customer_timeline_events` | `customer_timeline_events` insert 0 |

Execution caps for this PR:

- new store creation execution in this PR: `forbidden`
- production DB write in this PR: `forbidden`
- API write call in this PR: `forbidden`
- test inquiry save in this PR: `forbidden`
- customer/contact/inquiry/timeline/lead/payment row creation in this PR: `forbidden`
- RLS, GRANT, and REVOKE execution in this PR: `forbidden`
- migration apply, db push, migration repair, and SQL replay in this PR: `forbidden`
- manual deploy in this PR: `forbidden`
- Ready transition in this PR: `forbidden`
- merge in this PR: `forbidden`

## Post-Provisioning Confirmation

Post-provisioning confirmation is required before any customer-memory canary can be considered:

- post-provisioning exact-one-store lookup is required
- lookup must resolve exactly one test store for the approved slug or identifier
- sanitized store summary only
- no raw PII
- no customer rows
- no customer/contact/inquiry/timeline/lead/payment row samples
- selected test store confirmation packet
- separate customer-memory synthetic canary approval
- synthetic marker: `MYBIZ_CANARY_CUSTOMER_MEMORY_YYYYMMDD`
- canary write remains `BLOCKED` until a later approval packet

The future selected test store confirmation packet must record the resolved store identifier in a sanitized manner suitable for owner approval and must not expose unrelated production store details.

## Stop Conditions

Stop before or during any later provisioning approval if any of these conditions appears:

- slug conflict
- store count delta exceeds approved cap
- required membership/subscription relation unclear
- raw PII risk
- RLS/permission uncertainty
- any customer/inquiry/timeline row changes
- any customer/contact/inquiry/timeline/lead/payment row sample would be needed
- provisioning API behavior is broader than the approved table cap
- Vercel protection blocks a required read-back confirmation
- env/auth/payment/webhook changes are required

## Cleanup Posture

- deleting the test store requires separate approval
- cleanup execution in this PR: `forbidden`
- cleanup must not be bundled with the provisioning approval packet
- cleanup must use its own pre-count, post-count, and sanitized read-back evidence
- reverting this docs/tests-only PR requires only a source revert

## Business Output

User problem solved:

- gives the owner a safe approval packet for creating a dedicated customer-memory test store without reusing one of the six existing production stores

Revenue path supported:

- unblocks the next gated path toward customer-memory proof for PRO/VIP merchant operations while keeping real merchant/customer data out of the canary setup

Data that can be collected after separate approval:

- count-only store provisioning deltas
- sanitized exact-one-store confirmation
- later synthetic-only customer-memory canary evidence, if separately approved

Remaining before production launch:

- owner approval to provision the dedicated test store
- exact-one-store post-provisioning confirmation
- selected test store confirmation packet
- separate synthetic customer-memory canary approval
- cleanup or retained-test-store posture decision

## Validation Plan

Required before this PR can be considered for any status change:

- `git diff --check`
- `git diff --cached --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm test -- src/tests/customer-memory-test-store-provisioning-plan.test.ts`
- staged secret/PII scan
- Vercel preview checks

This PR must remain Draft. Ready conversion, merge, manual deploy, production DB writes, store creation execution, customer-memory writes, Supabase `db push`, migration repair/up/apply, SQL replay, and RLS/GRANT/REVOKE execution are not part of this approval packet.

## side_effects

```json
{
  "production_db_write": false,
  "test_store_created": false,
  "live_customer_memory_gate_enabled": false,
  "api_write_call": false,
  "test_inquiry_created": false,
  "customer_row_created": false,
  "inquiry_row_created": false,
  "timeline_row_created": false,
  "raw_pii_output_in_committed_files": false,
  "customer_row_sample_output": false,
  "rls_or_grant_executed": false,
  "migration_apply": false,
  "db_push": false,
  "sql_replay": false,
  "env_auth_payment_webhook_changed": false,
  "manual_deploy": false,
  "ready_transition": false,
  "merge": false,
  "canary_write_blocked": true,
  "test_store_provisioning_packet_created": true
}
```
