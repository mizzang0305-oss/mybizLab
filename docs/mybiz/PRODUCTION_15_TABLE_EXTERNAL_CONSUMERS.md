# 15-table external consumer inventory — R2

Status: **incomplete / fail closed**. `BLOCKED_UNKNOWN` means no active external consumer was proven absent; it does **not** mean the table is unused. No Production privilege was changed.

## Inventory sources checked

- Repository `api/**`, `src/server/**`, `src/shared/**`, `scripts/**`, package scripts, and `.github/workflows/**`: seven formerly unknown target tables have no exact direct PostgreSQL caller in active in-repo paths. `ai_reports` and `store_daily_metrics` appear in demo/in-memory state; `store_analytics_profile` singular differs from active plural `store_analytics_profiles`. Generic `events` references are not proof of the `public.events` relation.
- `vercel.json`: repository rewrites present; no repository-declared cron schedule. Vercel CLI 50.18.0 `project inspect mybizlab` confirmed the current Vite project/root but did not expose function/cron inventory; connected detailed-project retrieval did not succeed. An independent project-level function/cron inventory was not obtained. This is not proof of no Vercel consumer.
- Supabase read-only project inventory on 2026-09-23: deployed Edge Functions = 0. Catalog: `pg_cron` and `pg_net` extensions absent; noninternal triggers, dependent views, and explicit publication membership = 0 on all 15 targets. Public/private/core function-body name scan found only `create_store_with_owner` referencing `store_home_content` and `store_priority_settings` among target tables. No row values, credentials, or job commands were read.
- Provider/webhook source: billing webhook writes target `orders` from a launch-gated trusted-server path; no direct target access for the seven tables was found. This does not establish whether an out-of-repo provider/worker exists.
- Operational handover and external/local worker inventory: no authoritative active-worker manifest or independent operator attestation was available. Absence cannot be certified from grep alone.

| target table | in-repo browser | in-repo server route | Vercel cron | GitHub Actions | Supabase Edge | DB cron | DB trigger/function | webhook | external worker | final classification |
|---|---|---|---|---|---|---|---|---|---|---|
| ai_briefing_logs | none found | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| ai_reports | demo/in-memory only | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| events | none for `public.events` | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_analytics_profile | no singular-table call | no singular-table call | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_daily_metrics | demo/in-memory only | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_modules | none found | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |
| store_staff | none found | none found | unverified | no exact active call | none deployed | extension absent | none found | none found | unverified | BLOCKED_UNKNOWN |

## Closure requirement

For each table, obtain a current authoritative inventory of Vercel deployed functions/cron and any separately hosted worker or integration using this database. Then record `PROVEN_ACTIVE_CONSUMER` with exact operation and candidate compatibility, or `PROVEN_NO_ACTIVE_CONSUMER` supported by the combined operational inventory. Until then, `UNKNOWN_EXTERNAL_REMAINING=7` and Production Apply is blocked independently of the RPC P0.
