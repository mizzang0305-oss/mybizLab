# 15-table Data API and HTTP compatibility — R2

Status: **BLOCKED for Production Apply**. This is Draft PR #185 stacked on preserved Draft PR #184; PR #183 is unchanged. The 15-table candidate and rollback remain in `supabase/migration_drafts/`. No Production permission or data mutation is authorized here.

## Evidence boundary

- [GitHub local-stack run 35836940777](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35836940777) used CLI 2.117.0 and a disposable Ubuntu Docker Supabase project with PostgreSQL, GoTrue, PostgREST, and Kong. It used only synthetic Auth identities and fixture rows. Two clean runs each passed 254 Data API checks, including actual JWT role mapping, 15-table anon deny, own/cross/non-member RLS, service-role grants, payment-field browser UPDATE deny, and local rollback. The direct authenticated provisioning RPC also created a synthetic VIP store in both runs: **P0 bypass confirmed in the local implementation**.
- The fixture preserves the exact catalog shape of the 15 target tables from R1. Extra non-target support tables/functions in `mybiz_15_table_fullstack_support.sql` are deliberately synthetic; they are not a claim of full Production schema equivalence.
- Direct PostgREST responses are distinct from MyBiz application route responses. A Data API PASS cannot be promoted to a public, merchant, admin, or webhook route PASS.
- The real application handler network-wrapper test in `mybiz-15-table-fullstack-routes.test.ts` exercised public snapshot/order, onboarding setup-request, merchant order-event authorization, and the paid provisioning gate against the local stack: 4/4 baseline and 5/5 candidate in each clean run. This is the actual handler over loopback HTTP, not a Vercel deployment or a full Production-schema replay.

## Route contract under test

| route | method | trust zone / Auth | PostgreSQL role for target calls | target operations | candidate result | required result | status |
|---|---|---|---|---|---|---|---|
| `/api/public?resource=store` | GET | public, server-mediated | service_role | `menu_categories`, `menu_items`, `store_tables`, `orders`, `store_home_content` SELECT | 200, synthetic menu/table rows; no canonical page so legacy home fallback used | 200, menu/table data and legacy fallback | PASS LOCAL |
| `/api/public?resource=order` | POST | public, server-mediated | service_role | `orders` SELECT/INSERT, `sessions` INSERT in legacy shape | 200, synthetic order; no payment provider call | synthetic order created, no anon raw-table access | PASS LOCAL |
| `/api/public?resource=visitor-session` | POST | public, server-mediated | service_role | no target `sessions` call; uses `visitor_sessions` | not tested | route compatibility separately | BLOCKED |
| `/api/merchant?resource=order-event` | POST | bearer user checked before admin client | service_role | `orders` SELECT; `payment_events` is non-target | synthetic member 200, wrong-store 403 | member allow, wrong-store deny | PASS LOCAL |
| `/api/onboarding/setup-request` | POST | public server handler | service_role | `store_setup_requests` SELECT/INSERT | 201, one synthetic request per test; direct browser INSERT denied by Data API | accepted synthetic request once, direct browser denied | PASS LOCAL |
| `/api/stores/provision` | POST | server payment/plan gate | service_role RPC | `create_store_with_owner`, then target home/priority writes through definer | paid-no-payment 400; direct authenticated RPC bypass confirmed; free server path diagnostic pending | server gate cannot be bypassed and authorized free path works | **BLOCKED P0** |
| `/api/billing/webhook` | POST | provider-signed trusted server, launch gated | service_role | `orders` UPDATE when enabled | no provider execution | disabled or synthetic-compatible | BLOCKED |
| `/api/admin?resource=...` | various | platform-admin verified server | service_role | target needs per resource | no full-stack route test | authorization before service role | BLOCKED |
| direct browser `mvpService` | Data API | authenticated store member | authenticated | menu/table SELECT+INSERT; orders SELECT; priority SELECT+INSERT+UPDATE | direct PostgREST matrix PASS twice; actual mvpService invocation not run | own-store allow, cross/nonmember deny | PARTIAL |

`api/public.ts`, `api/merchant.ts`, `api/admin.ts`, `api/stores/provision.ts`, `api/onboarding/setup-request.ts`, and `vercel.json` define these paths. `src/server/publicApi.ts` performs public snapshot/order operations through `getSupabaseAdminClient()`. Its visitor-session route uses the separate `visitor_sessions` table; the target `sessions` table is reached by the legacy public-order compatibility path, not by equating the two.

## Security findings and readiness

| requirement | evidence | result |
|---|---|
| Anon direct access across all 15 target tables | 60 GET/POST/PATCH/DELETE probes per run | DENIED |
| Authenticated cross-store/non-member | local Auth JWT and PostgREST, including TEXT priority settings | DENIED |
| Authenticated DELETE | all 15 direct endpoints | DENIED |
| Browser order payment-column UPDATE | five sensitive fields, direct PostgREST | DENIED |
| Browser setup-request INSERT | direct PostgREST | DENIED |
| service_role grants | direct PostgREST required-operation matrix | PASS for tested operations |
| Real MyBiz HTTP handlers | local network-wrapper suite: snapshot/order/setup/merchant selected paths PASS; visitor session/order state/admin/webhook not exercised | PARTIAL |
| External consumer absence | [external inventory](PRODUCTION_15_TABLE_EXTERNAL_CONSUMERS.md) | BLOCKED_UNKNOWN |
| Provisioning RPC boundary | [RPC audit](PRODUCTION_RPC_EXPOSURE_AUDIT.md) | BYPASS CONFIRMED LOCAL |

Production Apply stays blocked even if the local candidate matrix is green. The separate RPC boundary repair must address the direct authenticated call **and** preserve a working authorized server provisioning path before any 15-table Apply approval is reconsidered.
