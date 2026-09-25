# MyBiz runtime access matrix

Branch: security/mybiz-rls-compat-v1
Purpose: classify current runtime dependencies before any database permission change.

| Table | Current code evidence | Working classification | Required action before hardening |
| --- | --- | --- | --- |
| store_tables | browser service has direct insert compatibility path; server public snapshot also reads store tables | mixed active | identify production caller and remove unnecessary browser mutation |
| sessions | explicit current insert found in server public API | server active | deny broad public table access after compatibility test |
| orders | server public/merchant APIs plus browser direct select/update compatibility in mvpService | mixed active | migrate or retire browser direct dependency first |
| events | no direct current table call found in initial repository search | legacy/unknown | check RPC/views/tests/migrations before quarantine |
| menu_categories | browser service direct insert compatibility path | mixed active | trace production provisioning path; prefer server boundary |
| menu_items | browser service direct insert compatibility path | mixed active | trace production provisioning path; prefer server boundary |
| store_staff | no direct current table call found in initial search | private/unknown | verify legacy dependencies; no public access expected |
| store_modules | no direct current table call found in initial search | private/unknown | verify legacy dependencies; no public access expected |
| ai_briefing_logs | no direct current table call found in initial search | server-or-legacy | verify background/API dependencies |
| store_analytics_profile | code currently references plural store_analytics_profiles instead | likely legacy | verify FK/view/RPC dependency before quarantine |
| store_priority_settings | browser Supabase client reads current settings | authenticated member candidate | design store-member scoped read policy or server path |
| store_daily_metrics | no direct current table call found in initial search | private/legacy candidate | verify analytics jobs and repository aliases |
| ai_reports | no direct current table call found in initial search | private/legacy candidate | verify report jobs and repository aliases |
| store_home_content | repository uses as legacy public-page fallback | legacy fallback | prove canonical store_public_pages success before quarantine |
| store_setup_requests | browser direct submission plus server admin read/update | mixed active | move submission to server path or add narrow compatible policy |

## Confirmed architectural split

- Browser database client exists and uses the public application database configuration.
- Server admin client exists and is already used by public order and merchant API handlers.
- Public order mutation paths should continue moving toward browser -> server API -> database.
- Merchant-private data should use authenticated store membership or server-side access, not broad public table access.

## Next implementation targets

1. store_setup_requests: confirm production browser currently uses server-backed save path; eliminate direct public insert if possible.
2. orders: identify every browser direct read/update and replace with existing server API where equivalent.
3. store_priority_settings: bind reads to authenticated store membership.
4. store_home_content: measure whether legacy fallback is still needed.
5. after the above, create a disposable-database permission migration and cross-store regression tests.

No Production DB changes are authorized by this matrix.
