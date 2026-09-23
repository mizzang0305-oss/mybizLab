# 15-table external consumer inventory — R2

Status: **incomplete / fail closed**. `BLOCKED_UNKNOWN` means no active external consumer was proven absent; it does **not** mean the table is unused. No Production privilege was changed.

R3.1 terminology: all seven `BLOCKED_UNKNOWN` rows below map to **UNVERIFIED**, not `PROVEN_NO_ACTIVE_CONSUMER`. Repository/workflow, point-in-time read-only database metadata and Edge Function inventory have coverage. The currently aliased Production deployment's Vercel function and deployment-config inventory is now observed, but an authoritative separately hosted worker/operator inventory and deployed-code access attestation are still unavailable. R3 RPC repair can be reviewed independently; the blanket 15-table `service_role` revocation cannot be approved on this evidence.

## Inventory sources checked

- Repository `api/**`, `src/server/**`, `src/shared/**`, `scripts/**`, package scripts, and `.github/workflows/**`: seven formerly unknown target tables have no exact direct PostgreSQL caller in active in-repo paths. `ai_reports` and `store_daily_metrics` appear in demo/in-memory state; `store_analytics_profile` singular differs from active plural `store_analytics_profiles`. Generic `events` references are not proof of the `public.events` relation.
- `vercel.json`: repository rewrites present; no repository-declared cron schedule. Read-only `vercel inspect mybiz.ai.kr --format=json` with CLI `50.18.0` on 2026-09-24 resolved the current Production alias to READY deployment `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5`. Its build output lists exactly 12 lambda entrypoints: `api/admin`, `api/ai/chat`, `api/ai/diagnosis`, `api/auth/session`, `api/billing/checkout`, `api/billing/verify`, `api/billing/webhook`, `api/health`, `api/merchant`, `api/onboarding/setup-request`, `api/public`, `api/stores/provision`. Its deployed `vercelConfig` has only schema/routes, with no `crons` declaration. A separate read-only inspection of the R3 Preview reported the same 12 entrypoints. This is **OBSERVED_NONE_WITH_COVERAGE for an additional scheduled Vercel function or declared Vercel cron on these inspected deployments only**; it does not prove that no external caller invokes a listed handler or uses a database credential elsewhere. No deployment or configuration was created or changed by these inspections.
- Supabase read-only project inventory on 2026-09-23: deployed Edge Functions = 0. Catalog: `pg_cron` and `pg_net` extensions absent; noninternal triggers, dependent views, and explicit publication membership = 0 on all 15 targets. Public/private/core function-body name scan found only `create_store_with_owner` referencing `store_home_content` and `store_priority_settings` among target tables. No row values, credentials, or job commands were read.
- Provider/webhook source: billing webhook writes target `orders` from a launch-gated trusted-server path; no direct target access for the seven tables was found. This does not establish whether an out-of-repo provider/worker exists.
- Operational handover and external/local worker inventory: no authoritative active-worker manifest or independent operator attestation was available. Absence cannot be certified from grep alone.

| target table | in-repo browser | in-repo server route | Vercel cron | GitHub Actions | Supabase Edge | DB cron | DB trigger/function | webhook | external worker | final classification |
|---|---|---|---|---|---|---|---|---|---|---|
| ai_briefing_logs | none found | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| ai_reports | demo/in-memory only | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| events | none for `public.events` | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_analytics_profile | no singular-table call | no singular-table call | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_daily_metrics | demo/in-memory only | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_modules | none found | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_staff | none found | none found | no declared Production cron | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |

## Closure requirement

For each table, obtain the following **specific missing authority** rather than repeating the same repository grep, Edge Function count or Production catalog scan:

| table | still-unverified system / required read authority |
|---|---|
| `ai_briefing_logs` | Operator-owned standalone AI/briefing worker and any external Supabase credential inventory: named owner must attest active/inactive job, deployment location, DB role and table operations; read-only job/service inventory access is needed. |
| `ai_reports` | Operator-owned report generation worker and any external Supabase credential inventory: named owner must attest active/inactive job, deployment location, DB role and table operations; read-only job/service inventory access is needed. |
| `events` | External event collector/analytics worker and any external Supabase credential inventory: named owner must identify whether it targets `public.events` specifically, its DB role and operations; read-only collector/service inventory access is needed. |
| `store_analytics_profile` | Operator-owned analytics/profile worker and any external Supabase credential inventory: confirm singular `public.store_analytics_profile` rather than plural app relation, DB role and operations; read-only worker/service inventory access is needed. |
| `store_daily_metrics` | Operator-owned daily-metrics/scheduled worker and any external Supabase credential inventory: named owner must attest scheduler/deployment, DB role and operations; read-only scheduler/service inventory access is needed. |
| `store_modules` | External provisioning/configuration worker and any external Supabase credential inventory: named owner must attest active/inactive deployment, DB role and operations; read-only worker/service inventory access is needed. |
| `store_staff` | External staffing/provisioning worker and any external Supabase credential inventory: named owner must attest active/inactive deployment, DB role and operations; read-only worker/service inventory access is needed. |

These are **investigation targets, not claims that such workers exist**. A bounded operator inventory should also identify any direct database client or Data API key outside this repository and whether an external service calls one of the 12 deployed Vercel handlers. Record `PROVEN_ACTIVE_CONSUMER` with exact operation and candidate compatibility, or `PROVEN_NO_ACTIVE_CONSUMER` only after an authoritative negative inventory/attestation. Coverage of the current deployed Vercel function list and lack of a declared cron does not close that external-account gap. Until then, `UNKNOWN_EXTERNAL_REMAINING=7`; Production 15-table permission Apply stays blocked independently of the RPC repair.
