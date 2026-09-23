# Production 15-table access contract — Draft, not Apply approval

Read-only Production `pg_catalog`/`has_table_privilege` evidence was captured in a local private receipt outside this repository; detailed current counts/grants are intentionally not in this public PR. All 15 targets currently have RLS off and broad effective access. Target SQL is draft-only at `supabase/migration_drafts/20260923040856_mybiz_15_table_rls_exact_shape_candidate.sql`. Source references and runtime flags are expanded in [the call-path matrix](PRODUCTION_15_TABLE_CALL_PATH_MATRIX.md).

`P` = PROVEN by in-repo source, `N` = NOT_REQUIRED by traced in-repo path, `U` = UNKNOWN external consumer, `B` = BLOCKED pending route proof. `PUBLIC` here means unauthenticated HTTP surface, which may use a server-side service role; it never automatically means a direct `anon` table grant. All target `anon` grants are `NONE`. The table reports current grants as `BROAD_PRIVATE` without publishing the detailed matrix.

| table | scope_key | scope_key_type | caller_surface | source_path | runtime_condition | postgres_role | operation | public_required | merchant_required | admin_required | server_required | PII_or_sensitive | payment_sensitive | current_effective_grant | current_RLS | target_grant | target_policy | evidence_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ai_briefing_logs | store_id | TEXT | none found | source scan | no direct call | none/U | none/U | N | N | N | U | U | N | BROAD_PRIVATE | OFF | none | deny all | U |
| ai_reports | store_id | TEXT | mock only | `mvpService` | demo only | none/U | none/U | N | N | N | U | U | N | BROAD_PRIVATE | OFF | none | deny all | U |
| events | store_id | UUID | none found | source scan | no direct call | none/U | none/U | N | N | N | U | sensitive payload | U | BROAD_PRIVATE | OFF | none | deny all | U |
| menu_categories | store_id | UUID | browser/public server | `mvpService`,`publicApi` | live optional | auth/service | SELECT,INSERT / SELECT | P via server | P | N | P | N | N | BROAD_PRIVATE | OFF | auth S,I; service S | member S,I | P + B route |
| menu_items | store_id | UUID | browser/public server | `mvpService`,`publicApi` | live optional | auth/service | SELECT,INSERT / SELECT | P via server | P | N | P | N | N | BROAD_PRIVATE | OFF | auth S,I; service S | member S,I | P + B route |
| orders | store_id | UUID | browser/public/merchant/webhook | `mvpService`,`publicApi`,`merchantApi`,`billingWebhook` | live optional | auth/service | browser SELECT; server S,I,U | P via server | P read | N | P | customer link | YES | BROAD_PRIVATE | OFF | auth S; service S,I,U | member SELECT only | P + B route |
| sessions | store_id | UUID | public server | `publicApi` | legacy order insert | service | INSERT | P via server | N | N | P | customer/UA/IP hash | N | BROAD_PRIVATE | OFF | service I | browser deny | P + B route |
| store_analytics_profile | store_id | TEXT | none found | source uses plural table | no direct singular call | none/U | none/U | N | N | N | U | business data | N | BROAD_PRIVATE | OFF | none | deny all | U |
| store_daily_metrics | store_id | TEXT | mock only | `mvpService` | demo only | none/U | none/U | N | N | N | U | business metrics | N | BROAD_PRIVATE | OFF | none | deny all | U |
| store_home_content | store_id | TEXT | public server fallback/provision RPC | `supabaseRepository`,`create_store_with_owner` | missing canonical page | service/definer | SELECT / INSERT | P via server | N | P RPC | P | public copy | N | BROAD_PRIVATE | OFF | service S | browser deny | P + B route |
| store_modules | store_id | UUID | none found | source scan | no direct call | none/U | none/U | N | N | N | U | entitlement data | N | BROAD_PRIVATE | OFF | none | deny all | U |
| store_priority_settings | store_id | TEXT | browser/provision RPC | `mvpService`,`create_store_with_owner` | Supabase live | auth/definer | SELECT,INSERT,UPDATE / INSERT | N | P | P RPC | P | business config | N | BROAD_PRIVATE | OFF | auth S,I,U | text member S,I,U | P + B route |
| store_setup_requests | created_by | UUID nullable | server onboarding/provision | `onboardingSetupRequest`,`api/stores/provision` | non-demo browser goes server | service | SELECT,INSERT,UPDATE | P via server | N | P | P | contact/owner fields | N | BROAD_PRIVATE | OFF | service S,I,U | browser deny; old policies retained | P + B route |
| store_staff | store_id | UUID | none found | source scan | no direct call | none/U | none/U | N | N | N | U | user ID/role | N | BROAD_PRIVATE | OFF | none | deny all | U |
| store_tables | store_id | UUID | browser/public server | `mvpService`,`publicApi` | live optional | auth/service | SELECT,INSERT / SELECT | P via server | P | N | P | N | N | BROAD_PRIVATE | OFF | auth S,I; service S | member S,I | P + B route |

## Operation-specific invariants

- Design basis: Supabase's [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Data API security guide](https://supabase.com/docs/guides/api/securing-your-api) require both object grants and row policies to be correct; `service_role` bypasses RLS and must remain server-side.
- `GRANT` and RLS are independent gates. `anon` gets no direct target-table access. Authenticated users receive only the five proven browser read tables; no target DELETE/TRUNCATE/TRIGGER/REFERENCES grants.
- UUID scope uses existing `public.is_store_member(store_id)` unchanged. TEXT priority scope uses one private fixed-search-path SECURITY DEFINER helper comparing `store_members.store_id::text` with input TEXT. It never casts arbitrary TEXT to UUID. All six TEXT tables were assessed by aggregate-only count/match queries; currently populated values match canonical stores, but no future format constraint is assumed.
- `orders` has payment status/source/method/timestamp and customer link fields. Browser `SELECT` is scoped to store membership; browser `UPDATE` is denied. Public order creation and payment terminal mutation remain server-side. This is not proof that all server business checks are complete.
- `store_setup_requests.created_by` is nullable in the exact schema. Its two existing own-row policies are dormant while RLS is off. The Owner selected **server-only** for this gate, so the draft keeps those policies but removes browser grants after enabling RLS. A future owner-scope design is separate.
- No table-wide browser UPDATE is proposed except `store_priority_settings`, whose policy has both `USING` and `WITH CHECK`. No target DELETE is granted to browser roles.

## Apply blockers

`UNKNOWN_EXTERNAL` on no-path server/background tables and `B` on exact route-to-DB integration are unresolved. A green SQL matrix is necessary but not sufficient for a Production permission change. Do not promote the draft until these are closed and the Owner separately approves Apply.
