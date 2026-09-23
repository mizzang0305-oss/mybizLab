# 15-table call-path matrix — Draft PR #184

Base: PR #183 `065b1b404531df8c62927a301f9f032e0ddd8ae1`. Source scan: 2026-09-23. This is a source-level inventory, not proof that every historical or external consumer has been observed. MyBiz remains Business Service OS; menu/order/table flows are optional legacy restaurant capabilities.

Legend: `B` browser Supabase client (`authenticated`); `P` public HTTP server using admin/service role; `M` authenticated merchant HTTP server using admin/service role after store-access check; `A` platform/provisioning server using admin/service role; `W` trusted webhook; `D` demo/mock only; `—` no direct call found. `UNKNOWN_EXTERNAL` prevents Production Apply certification until operational consumer evidence closes it.

| table | DIRECT_BROWSER | PUBLIC_SERVER_API | MERCHANT_SERVER_API | ADMIN_SERVER_API | BACKGROUND | WEBHOOK | LEGACY | RUNTIME_STATUS |
|---|---|---|---|---|---|---|---|---|
| ai_briefing_logs | — | — | — | — | UNKNOWN_EXTERNAL | — | — | no direct source path; external consumers unproven |
| ai_reports | D | — | — | — | UNKNOWN_EXTERNAL | — | in-memory reports | no direct PostgreSQL path |
| events | — | — | — | — | UNKNOWN_EXTERNAL | — | distinct from `payment_events` | no direct path |
| menu_categories | B SELECT/INSERT | P SELECT | — | — | — | — | restaurant optional | live browser + public snapshot |
| menu_items | B SELECT/INSERT | P SELECT | — | — | — | — | restaurant optional | live browser + public snapshot |
| orders | B SELECT; dead UPDATE branch | P SELECT/INSERT/UPDATE | M SELECT | — | — | W UPDATE | payment-sensitive legacy | live optional/public order/webhook |
| sessions | — | P INSERT | — | — | — | — | public order compatibility | server-only insert |
| store_analytics_profile | — | — | — | — | UNKNOWN_EXTERNAL | — | singular table; source uses plural `store_analytics_profiles` | no direct path |
| store_daily_metrics | D | — | — | — | UNKNOWN_EXTERNAL | — | mock metrics | no direct PostgreSQL path |
| store_home_content | browser fallback removed in PR #184 | P SELECT fallback | — | provisioning SECURITY DEFINER INSERT | — | — | superseded by `store_public_pages` | server-only fallback |
| store_modules | — | — | — | — | UNKNOWN_EXTERNAL | — | mock/module config | no direct path |
| store_priority_settings | B SELECT/INSERT/UPDATE upsert | — | — | provisioning SECURITY DEFINER INSERT | — | — | UUID-as-TEXT tenant key | live merchant settings |
| store_setup_requests | unreachable browser fallback | — | — | A SELECT/INSERT/UPDATE | — | — | `created_by` nullable | server-only by Owner decision |
| store_staff | — | — | — | — | UNKNOWN_EXTERNAL | — | distinct from `store_members` | no direct path |
| store_tables | B SELECT/INSERT | P SELECT | — | — | — | — | restaurant optional | live browser + public snapshot |

## Trust-zone evidence

- `src/server/publicApi.ts` gets `getSupabaseAdminClient()` for snapshot, public order and session creation. Public HTTP does **not** imply PostgreSQL `anon`. `api/public.ts` dispatches these routes. Its public-order input/eligibility checks remain application-layer controls; `service_role` itself bypasses RLS.
- `src/server/merchantApi.ts` resolves bearer identity and store access before admin-client order reads. `src/server/platformAdminApi.ts` verifies platform-admin authorization before privileged handlers. These controls need exact route integration tests before Apply.
- `src/server/billingWebhook.ts` updates order payment fields only in the server webhook path; `authenticated` table-wide `UPDATE` is not needed. The client `attachCustomerToOrder` direct `orders.UPDATE` branch in `mvpService.ts` is unreachable after its earlier live server-route return; it remains a removal follow-up, not a grant justification.
- `src/shared/lib/services/mvpService.ts` uses the browser client for live menu/table read and insert, orders read, and priority-settings upsert. Non-demo browser setup requests use `/api/onboarding/setup-request`; the later direct insert branch is not reachable in that browser condition.
- `src/shared/lib/repositories/supabaseRepository.ts` originally attempted `store_home_content` when canonical `store_public_pages` was absent. PR #184 keeps that fallback server-side only. Read-only Production aggregate evidence showed canonical pages cover the currently populated legacy rows; no row data was exported.
- `public.create_store_with_owner` is `SECURITY DEFINER` owned by `postgres`; it inserts `store_priority_settings` and `store_home_content`. The candidate enables but does not FORCE RLS, preserving the function's owner bypass. This is distinct from unrestricted browser access.

## Unclosed route proof

Source classification is not an end-to-end route test against an exact-shape PostgREST/Data API. Public snapshot/order/session, merchant menu/table/settings, admin provisioning, and webhook behavior need isolated HTTP integration coverage. Outside-repo background consumers for six no-path tables are `UNKNOWN_EXTERNAL`; default-deny is the draft target, but Production Apply remains blocked until verified.
