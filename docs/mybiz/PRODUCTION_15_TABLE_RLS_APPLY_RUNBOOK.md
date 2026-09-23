# 15-table RLS Owner Apply runbook — not authorized in this phase

**Current status: STOP.** The candidate is an unapplied draft. PR #184 must stay Draft; PR #183 remains unchanged. No Production `ENABLE RLS`, policy, GRANT/REVOKE, data, Auth or app deployment operation is approved by this document.

## Preconditions for a future separate Owner Gate

1. Close every `UNKNOWN_EXTERNAL` and route-level `BLOCKED` entry in [the access contract](PRODUCTION_15_TABLE_ACCESS_CONTRACT.md). Capture public, merchant, platform-admin, provisioning, webhook and background trust paths against an ephemeral exact-shape Data API. Do not infer a Postgres role from HTTP audience.
2. Reconfirm project ref `plnuyudyogbzwpmdulnw`, source HEAD, candidate file SHA-256 and rollback file SHA-256. Obtain explicit approval naming that exact project, HEAD, files/hashes and one apply attempt. A green Draft PR is not approval.
3. Refresh sanitized read-only Production metadata: exact 15 relation/column/type/constraint/index fingerprint, RLS flags, policies, seven effective privileges for each of three roles, TEXT key aggregate cast/mapping counts, aggregate row counts, helper collision, and migration history. Abort on any unexplained drift.
4. Verify `public.is_store_member(uuid)` and `public.create_store_with_owner` fingerprints and the current private-schema grants. Confirm admin/service clients never expose their credential to browsers. Verify no unexpected public/merchant mutation route.
5. Run two clean ephemeral rehearsals and rollback again at the sealed exact source. Include Supabase security/performance advisors where available and classify pre-existing warnings separately. Require no mixed state and no unjustified anon/authenticated privilege.
6. Prepare a maintenance window, independent postcheck operator, sanitized receipt destination, and incident stop/rollback decision. Rollback reverses permission hardening and reopens prior broad grants; treat it as an incident action, not an automatic retry.

## Conditional future apply sequence

Only after the separate approval: seal source hash → read-only precheck → promote exactly one candidate into official migration path without editing bytes → apply once transactionally → independently compare exact target policy/grant matrix and source hashes → run non-mutating public/merchant/admin HTTP smoke → STOP. Never auto-retry or apply the rollback because a check merely times out. On an unexpected state, stop and escalate; do not edit live SQL.

## Postcheck contract

- Exactly 15 target tables have RLS enabled; no target FORCE RLS unless separately redesigned and rehearsed. Original two `store_setup_requests` policies remain but browser has no table grants.
- `anon` has no direct privilege on any target; `authenticated` grants match the contract; no browser DELETE/TRUNCATE/REFERENCES/TRIGGER and no browser `orders.UPDATE`.
- `service_role` gets only proven operations. Verify actual server auth/eligibility before its mutations; RLS bypass is not server authorization.
- `public.is_store_member(uuid)`, non-target policies, Auth, store memberships, target row counts and customer/order data are unchanged by the migration.
- Public snapshot, menu/table, order-state/session, merchant, admin/provisioning and webhook HTTP behavior remains compatible. Record each status and SQLSTATE without raw payloads or identifiers.

If any precondition or route proof is unavailable, the only authorized result is **BLOCKED / no Production apply**.
