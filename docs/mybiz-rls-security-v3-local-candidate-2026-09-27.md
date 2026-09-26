# MyBiz security V3 local candidate

Status: local candidate only. PR #188 remains Draft and its remote head is unchanged. No Production SQL, deployment, payment, or customer data mutation was performed.

## Scope and source of truth

- Target Supabase project for a future, separately approved release: `plnuyudyogbzwpmdulnw` (`Mybiz Project`). This document does not authorize applying SQL there.
- Canonical code branch: `codex/mybiz-rls-security-compat-v1` (PR #188). PR #189 is held and must not be mixed into this rollout.
- V2's 15-table hardening and the 33 existing policy/22-table identity baseline are preserved as separate gates. V3 changes the existing `public.is_store_member(uuid)` body without rewriting the other policy predicates, then narrows the three core tables.
- All SQL remains in `supabase/migration_drafts/`; no canonical Production migration was created.

## V3 changes

| Boundary | Local candidate |
| --- | --- |
| `store_members` | `anon` no CRUD; `authenticated` SELECT through existing own-store policy; writes server only. Existing INSERT/UPDATE policies are dropped after exact policy-name guard. |
| `store_subscriptions` | `anon` no CRUD; `authenticated` own-store SELECT only; entitlement writes server only. Initial row is inserted by verified-owner provisioning in the same transaction as store and owner membership. |
| `stores` | `anon` no CRUD; `authenticated` own-store SELECT and column UPDATE only for `name`, `timezone`, `brand_config`, `slug`. No browser INSERT, DELETE, `plan` or `trial_ends_at` UPDATE. |
| Browser setup request | Non-demo runtime always submits through `/api/onboarding/setup-request`; no direct table INSERT fallback. |
| Public storefront | Live browser uses `/api/public/store`; an API failure does not fall through to anonymous `stores` reads. |
| Browser settings | Existing-store UPDATE, never UPSERT. |
| Paid onboarding | Authenticated owner email must match request before checkout. A verified payment followed by activation failure remains `paymentStatus=paid`; UI instructs the customer not to pay again. |

## Disposable CI execution order

The existing workflow `.github/workflows/mybiz-rls-security-certification.yml` copies and applies these files in its isolated Supabase root, then runs pgTAP, actual PostgREST/HTTP tests, app quality gates, and rollback rehearsal:

1. Synthetic Production-like schema fixture.
2. Existing provisioning function fixture.
3. Verified profile resolver draft.
4. Existing-policy identity compatibility draft.
5. Verified-owner provisioning draft.
6. V2 15-table hardening draft.
7. V3 core-table least-privilege draft.

V3 pgTAP and PostgREST checks cover anonymous denial, own/cross-store reads, safe settings UPDATE, forbidden entitlement/membership writes, revoked identity, exact-ID and bound identity, and service-role provisioning. The paid test uses a synthetic provider response. The CI workflow cannot test these local edits until a separately approved normal push updates PR #188.

## Rollout and rollback gate

Before any future Production change, confirm the exact project identity, fresh catalog/policy/grant/function ACL inventory, backup and recovery/PITR status, and approved migration/code hashes. A mismatch stops the rollout. Hold provisioning and merchant settings writes during the transition because old browser code and new grants are incompatible, and new code requires the verified-owner RPC. Apply reviewed SQL in order, deploy the exact compatible app, perform scoped synthetic smoke, then reopen held writes only after success.

On failure, keep RLS enabled, keep anonymous core and legacy CRUD denied, preserve all existing rows, and hold client writes. The safe rollback draft revokes the four browser settings UPDATE columns while preserving service-role paths. Do not restore broad anonymous or authenticated CRUD as an automatic rollback. Application rollback must use a previously approved version compatible with these restricted grants; otherwise keep affected routes held while preparing a reviewed fix.

## Evidence status

- Local TypeScript/unit/lint/build gates are recorded in the final task report for the exact local commit.
- Local Windows has no Docker, `psql`, or Supabase CLI; WSL is unavailable. Actual V3 SQL apply, pgTAP, Data API, and rollback results are `NOT_RUN_LOCAL` until hosted CI on the pushed exact SHA.
- Backup/PITR evidence: `UNKNOWN`, required before Production approval.
- `MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY=false`; Biz2Lab Commercial Production and AgentOps stay on hold.
