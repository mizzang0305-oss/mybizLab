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

## Target access matrix for the 15 Production findings

`S/I/U/D` below means SELECT/INSERT/UPDATE/DELETE. `none` means no direct Data API grant. Server access is through the existing service-role client only. Every target table enables RLS. The target is a review draft pending disposable DB proof.

| Table | Active classification / evidence | Target anon | Target authenticated | Server | Policy / code change |
| --- | --- | --- | --- | --- | --- |
| store_tables | PUBLIC_READ_REQUIRED + AUTH_MEMBER_REQUIRED; public snapshot, merchant editor/order read | none | S/I own store | S/I/U/D | Existing `is_store_member(store_id)`; public reads via server snapshot; merchant order read via server |
| sessions | SERVER_ONLY; public session creation in `publicApi.ts` | none | none | S/I/U/D | No browser policy; public API writes |
| orders | SERVER_ONLY_PUBLIC_FLOW + MERCHANT_PRIVATE; public order API, merchant API | none | none | S/I/U/D | Merchant read and event API; no browser raw order grant |
| events | UNUSED_LEGACY candidate; no direct current table caller found | none | none | S/I/U/D | Quarantine, no DROP; dependency search remains required |
| menu_categories | PUBLIC_READ_REQUIRED + AUTH_MEMBER_REQUIRED; public snapshot, merchant editor | none | S/I own store | S/I/U/D | Public snapshot server read; existing store-member policy for editor |
| menu_items | PUBLIC_READ_REQUIRED + AUTH_MEMBER_REQUIRED; public snapshot, merchant editor | none | S/I own store | S/I/U/D | Public snapshot server read; existing store-member policy for editor |
| store_staff | UNKNOWN_BLOCKER, no direct current caller | none | none | S/I/U/D | Quarantine; verify indirect jobs/RPC before Production |
| store_modules | UNKNOWN_BLOCKER, no direct current caller | none | none | S/I/U/D | Quarantine; verify indirect jobs/RPC before Production |
| ai_briefing_logs | UNKNOWN_BLOCKER, no direct current caller | none | none | S/I/U/D | Quarantine; verify indirect jobs/RPC before Production |
| store_analytics_profile | UNUSED_LEGACY candidate; singular table has 0 Production rows; plural table has 6 | none | none | S/I/U/D | Quarantine; do not confuse with active plural table |
| store_priority_settings | AUTH_MEMBER_REQUIRED; live provisioning/brand/dashboard browser S/I/U | none | S/I/U own store | S/I/U/D | Membership policy casts validated UUID-shaped text store ID |
| store_daily_metrics | UNKNOWN_BLOCKER, no direct current caller | none | none | S/I/U/D | Quarantine; verify indirect jobs/RPC before Production |
| ai_reports | UNKNOWN_BLOCKER, no direct current caller | none | none | S/I/U/D | Quarantine; verify indirect jobs/RPC before Production |
| store_home_content | LEGACY_FALLBACK; public server fallback; 6 rows all have canonical public page | none | none | S/I/U/D | Preserve server fallback, no direct client policy |
| store_setup_requests | SERVER_ONLY; onboarding API and provisioning API | none | none | S/I/U/D | Remove browser insert fallback; preexisting own-row policies have no client grant |

All 15 currently have RLS disabled and broad anon/authenticated CRUD in the verified baseline. Production grants and policies were not changed in this work.

The `store_tables`, `menu_categories`, `menu_items`, and `store_priority_settings` policies use the existing `is_store_member(uuid)` helper. This helper resolves only exact Auth/profile IDs. A nonidentical but active Auth/profile binding is a documented compatibility gap, not a claimed PASS. No anon UPDATE/DELETE and no authenticated DELETE are proposed.

## Exact client operation matrix

`Y` means the proposed grant and RLS policy allow the operation for the specified role and own store. `N` means no direct Data API grant. These are target permissions tested on a synthetic fixture, not current Production permissions. The server service-role path retains existing CRUD privileges for all 15 tables. Public content reaches clients through the existing server API, not anonymous table access.

| Table | Anon S | Anon I | Anon U | Anon D | Auth S | Auth I | Auth U | Auth D | Store scoped | Public content | Server R/W |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| store_tables | N | N | N | N | Y | Y | N | N | Y | Y | Y/Y |
| sessions | N | N | N | N | N | N | N | N | Y | N | Y/Y |
| orders | N | N | N | N | N | N | N | N | Y | N | Y/Y |
| events | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| menu_categories | N | N | N | N | Y | Y | N | N | Y | Y | Y/Y |
| menu_items | N | N | N | N | Y | Y | N | N | Y | Y | Y/Y |
| store_staff | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| store_modules | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| ai_briefing_logs | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| store_analytics_profile | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| store_priority_settings | N | N | N | N | Y | Y | Y | N | Y | N | Y/Y |
| store_daily_metrics | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| ai_reports | N | N | N | N | N | N | N | N | unknown legacy | N | Y/Y |
| store_home_content | N | N | N | N | N | N | N | N | Y | legacy fallback | Y/Y |
| store_setup_requests | N | N | N | N | N | N | N | N | request scoped | N | Y/Y |

Here S/I/U/D are SELECT/INSERT/UPDATE/DELETE. Current Production still has RLS disabled and broad anon/authenticated CRUD on every listed table. For legacy/unknown tables the absence of a current repository caller does not prove external callers are absent.
