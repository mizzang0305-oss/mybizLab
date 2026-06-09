# MyBiz RLS migration approval checklist

Date: 2026-06-08

Use this checklist before applying any production migration or RLS policy for store membership, subscriptions, public pages, or customer memory.

## Hard stop conditions

Stop before applying if any item is true:

- production DB target is unclear.
- rollback plan is missing.
- migration diff includes payment/webhook/auth/env changes outside the approved scope.
- policy allows cross-store reads or writes.
- public insert policy can write arbitrary `store_id`.
- service role policy is used as a substitute for user/member authorization.
- customer PII, tokens, cookies, sessions, payment payloads, or raw browser storage would be logged.
- owner approval is missing.

## Required pre-approval evidence

| Area | Evidence required |
| --- | --- |
| Branch state | Current branch, base commit, changed files |
| Migration scope | Exact migration files and SQL summary |
| RLS scope | Exact tables, policies, roles, and predicates |
| Store membership | Proof dashboard reads require `store_members` |
| Customer memory | Proof `customers`, contacts, preferences, and timeline events are store-scoped |
| Public inserts | Proof public forms cannot write arbitrary stores |
| Subscription truth | Proof paid decisions use canonical `store_subscriptions` |
| Rollback | Revert or down-migration plan |
| Validation | Local typecheck, build, targeted tests, full tests |
| Side effects | Explicit confirmation of no payment provider call, webhook mutation, auth/env mutation, customer notification, external API mutation, or deploy |

## Tables requiring RLS verification

- `profiles`
- `stores`
- `store_members`
- `store_subscriptions`
- `store_public_pages`
- `visitor_sessions`
- `customers`
- `customer_contacts`
- `customer_preferences`
- `inquiries`
- `reservations`
- `waiting_entries`
- `customer_timeline_events`

## Minimum policy expectations

- Store members can read only rows for their stores.
- Store owners/managers can update only approved store-owned surfaces.
- Staff access must be intentionally scoped.
- Public read is limited to public store page data.
- Public insert is limited to owner-reviewed lead capture or approved public forms.
- Customer timeline events are append-only from approved flows.
- Customer memory writes require `store_id`, `customer_id`, consent/retention policy, and launch-gate approval.
- Broad DB write must remain disabled unless the approval explicitly enables it.

## Commands to run before approval

```powershell
git diff --check
npm run typecheck
npm run build
npm test -- --run src/tests/launch-gates.test.ts
npm test -- --run src/tests/store-membership-policy.test.ts src/tests/customer-memory-spine.test.ts src/tests/repository-boundary.test.ts
npm test -- --run
```

## Approval record template

```json
{
  "migration_apply": false,
  "rls_policy_apply": false,
  "db_write": false,
  "payment_provider_call": false,
  "webhook_change": false,
  "auth_or_env_change": false,
  "customer_notification": false,
  "external_api_mutation": false,
  "approved_by_owner": false,
  "rollback_plan_ready": false
}
```
