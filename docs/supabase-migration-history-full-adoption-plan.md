# Supabase Migration History Full Adoption Plan

Status: docs/tests-only Draft PR plan. This document inventories all current local-only Supabase migrations and classifies whether migration-history repair can be considered later. It does not approve or execute production metadata repair, `npx supabase db push`, `npx supabase migration up`, SQL migration body replay, RLS policy apply, GRANT/REVOKE, live lead write enablement, live customer memory write enablement, env/auth/payment/webhook changes, customer data creation, business table row writes, manual deploys, or stash cleanup.

Baseline:
- Repository: `mizzang0305-oss/mybizLab`
- Origin main HEAD: `ebcb2599b6474efeb6a8e7e934d40370dc24c5e8`
- Evidence date: 2026-06-14 KST
- Production project ref check: `production_project_ref_match: true`
- Supabase CLI: `npx supabase --version` available in prior preflight
- Migration list source: `npx supabase migration list --linked`
- Parsed migration-list rows: `15`
- Remote applied rows: `0`
- Local-only rows: `15`
- Target migration: `20260609_lead_capture_requests.sql`, currently local-only
- PII posture: no `SELECT *`, no row samples, no customer name/phone/email/message/memo output

Official references reviewed:
- https://supabase.com/docs/reference/cli/supabase-migration-list
- https://supabase.com/docs/reference/cli/supabase-migration-repair
- https://supabase.com/docs/reference/cli/supabase-db-push

## Decision Summary

Single-version repair for `20260609` is blocked because all 15 local migrations are local-only and the remote migration history has no applied rows. A safe migration-history adoption plan must account for the full local migration set, not only the lead-capture target migration.

Current repair sequence recommendation: `REPAIR_SEQUENCE_BLOCKED`.

Reason:
- Not every migration is classified as `SAFE_TO_REPAIR_APPLIED`.
- Some migrations have missing production schema evidence.
- One migration appears obsolete or draft relative to the current production schema names.
- Two local files share the same `20260424` version prefix, so future adoption must confirm how the Supabase CLI and remote migration-history table handle that duplicate version before any command sequence is generated.
- Therefore this PR must not propose a concrete version-by-version repair sequence.

## Local Migration Inventory

Classification values:
- `SAFE_TO_REPAIR_APPLIED`: production schema evidence indicates the migration's schema-level target is already reflected, so metadata repair may be considered later after owner approval.
- `NEEDS_SCHEMA_APPLY`: production schema evidence shows missing objects or columns from the migration target; metadata repair would hide an unapplied schema change.
- `OBSOLETE_OR_DRAFT`: migration target appears superseded, legacy, or not aligned with the current production schema naming.
- `UNSAFE_DESTRUCTIVE`: migration contains destructive data/table operations that should not be adopted as applied without a separate mitigation plan.
- `UNKNOWN_NEEDS_EVIDENCE`: read-only catalog/count evidence is insufficient to prove the migration's intended state.

| Version | Filename | Purpose summary | DDL | DML | RLS | Grant | Trigger | Function | Destructive SQL | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `20260405` | `20260405_mybiz_v2_phase1_phase2.sql` | Customer memory spine, store subscription alignment, customer contacts/preferences/timeline bootstrap. | yes | yes | yes | no | yes | yes | constraint/policy/trigger drops only | `NEEDS_SCHEMA_APPLY` |
| `20260406` | `20260406_mybiz_v2_phase3.sql` | Inquiry, reservation, waiting, visitor, and conversation operational tables. | yes | yes | yes | no | yes | no | policy/trigger drops only | `NEEDS_SCHEMA_APPLY` |
| `20260422` | `20260422_orders_payment_fields.sql` | Adds payment status/method/source/timestamp fields and payment lookup index to orders. | yes | no | no | no | no | no | none | `SAFE_TO_REPAIR_APPLIED` |
| `20260424` | `20260424_public_store_text_backfill.sql` | Backfills public-facing store text, page text, and brand profile text where legacy columns exist. | no | yes | no | no | no | no | none | `UNKNOWN_NEEDS_EVIDENCE` |
| `20260424` | `20260424_store_subscriptions_canonical_alignment.sql` | Reconciles `store_subscriptions` canonical columns, trigger, member policy, and legacy subscription backfill. | yes | yes | yes | no | yes | no | policy/trigger drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260501` | `20260501_platform_admin_console.sql` | Platform admin console tables for settings, pricing, billing products, promotions, announcements, boards, media, and audit logs. | yes | yes | yes | no | no | no | policy drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260503` | `20260503_public_site_operating_system.sql` | Platform public site CMS tables, content versions, snapshots, quality rules, and effect presets. | yes | yes | yes | no | no | no | policy drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260509` | `20260509_store_content_engine_mvp.sql` | Store reviews, blog posts, media assets, social accounts, and social publish jobs. | yes | no | yes | no | yes | no | policy/trigger drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260510` | `20260510_review_request_links.sql` | Review request links table, indexes, updated-at trigger, and member policy. | yes | no | yes | no | yes | no | policy/trigger drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260511` | `20260511_order_items_canonical.sql` | Canonical order item read model with additive columns, indexes, and member policy. | yes | yes | yes | no | no | no | policy drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260511` | `20260511_review_abuse_guard.sql` | Review submission abuse/rate-limit attempt tracking table and member-only policy. | yes | no | yes | no | no | no | policy drops only | `NEEDS_SCHEMA_APPLY` |
| `20260511` | `20260511_review_public_safety_hardening.sql` | Hardens public review flow by removing public review read policy and adding token controls to review links. | yes | no | yes | no | no | no | policy drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260523` | `20260523_store_brand_theme_v2.sql` | Adds brand theme columns to stores, public pages, and store requests using legacy table names. | yes | no | no | no | no | no | constraint drops only | `OBSOLETE_OR_DRAFT` |
| `20260603` | `20260603_store_oauth_credentials.sql` | Store OAuth credentials table with service-role policy and updated-at trigger. | yes | no | yes | no | yes | yes | trigger drops only | `SAFE_TO_REPAIR_APPLIED` |
| `20260609` | `20260609_lead_capture_requests.sql` | Lead capture request table reconciliation, required canonical columns, RLS, policies, indexes, and trigger. | yes | yes | yes | no | yes | no | policy/trigger drops only | `SAFE_TO_REPAIR_APPLIED` |

Inventory count: `15` local migration files.

## Production Read-Only Evidence Summary

Evidence method:
- Supabase CLI/link preflight already succeeded.
- Production project ref match was confirmed before evidence collection.
- Evidence is catalog/count/metadata only.
- No row samples were read.
- No business table rows were inserted, updated, or deleted.

Schema objects present:
- Core customer/memory tables: `conversation_messages`, `conversation_sessions`, `customer_contacts`, `customer_preferences`, `customer_timeline_events`, `customers`.
- Store operations tables: `inquiries`, `reservations`, `waiting_entries`, `visitor_sessions`, `orders`, `order_items`.
- Platform admin/site tables: `platform_admin_members`, `platform_announcements`, `platform_audit_logs`, `platform_banners`, `platform_billing_products`, `platform_board_posts`, `platform_content_quality_rules`, `platform_content_versions`, `platform_effect_presets`, `platform_faq_items`, `platform_feature_flags`, `platform_footer_settings`, `platform_homepage_sections`, `platform_media_assets`, `platform_page_sections`, `platform_pages`, `platform_popups`, `platform_pricing_plans`, `platform_promotions`, `platform_site_settings`, `platform_site_snapshots`, `platform_trust_signals`.
- Store content tables: `review_request_links`, `social_accounts`, `social_publish_jobs`, `store_blog_posts`, `store_media_assets`, `store_oauth_credentials`, `store_public_pages`, `store_reviews`, `store_subscriptions`.
- Lead capture target table: `lead_capture_requests`.

Missing or mismatched schema evidence:
- `normalize_customer_phone` function missing.
- Early customer/operation updated-at triggers missing: `trg_conversation_sessions_set_updated_at`, `trg_customer_contacts_set_updated_at`, `trg_customer_preferences_set_updated_at`, `trg_customers_set_updated_at`, `trg_inquiries_set_updated_at`, `trg_reservations_set_updated_at`, `trg_store_public_pages_set_updated_at`, `trg_visitor_sessions_set_updated_at`, `trg_waiting_entries_set_updated_at`.
- Early customer/operation indexes missing: `conversation_messages_session_created_idx`, `conversation_sessions_store_updated_idx`, `customer_contacts_store_customer_idx`, `customer_contacts_store_type_normalized_idx`, `customer_preferences_store_customer_idx`, `customer_timeline_events_store_customer_occurred_idx`, `inquiries_store_created_idx`, `inquiries_store_customer_idx`, `reservations_store_customer_reserved_idx`, `store_public_pages_slug_idx`, `stores_store_id_idx`, `visitor_sessions_store_last_seen_idx`, `visitor_sessions_store_token_idx`, `waiting_entries_store_customer_created_idx`.
- Early customer/operation columns missing: `customers.updated_at`, `waiting_entries.updated_at`.
- Review abuse table missing: `review_submit_attempts`.
- Review abuse indexes and policy missing because the table is missing.
- Legacy brand-theme target tables/columns missing: `public_pages`, `store_requests`, `stores.font_family`, `stores.theme_preset`, `stores.brand_logo_url`.

Evidence supporting `SAFE_TO_REPAIR_APPLIED` classifications:
- `orders` payment columns and `orders_store_payment_status_idx` exist.
- `store_subscriptions` canonical columns, unique index, trigger, RLS, and member policy exist.
- Platform admin/site tables and indexes exist with RLS enabled.
- Store content engine tables, indexes, triggers, RLS, and member/public policies are reflected, with the later review hardening migration superseding the earlier public review policy.
- `review_request_links` table, token columns, indexes, trigger, RLS, and member policy exist.
- `order_items` canonical columns, indexes, RLS, and member policy exist.
- `store_oauth_credentials` table, RLS, service-role policy, function, and trigger exist.
- `lead_capture_requests` target posture is reflected; see the target migration section below.

## Classification Table

| Filename | Classification | Evidence-driven reason |
| --- | --- | --- |
| `20260405_mybiz_v2_phase1_phase2.sql` | `NEEDS_SCHEMA_APPLY` | Several early indexes/triggers plus `normalize_customer_phone` and `customers.updated_at` are missing. |
| `20260406_mybiz_v2_phase3.sql` | `NEEDS_SCHEMA_APPLY` | Target tables exist, but several early operational indexes/triggers and `waiting_entries.updated_at` are missing. |
| `20260422_orders_payment_fields.sql` | `SAFE_TO_REPAIR_APPLIED` | Orders payment columns and payment-status index are present. |
| `20260424_public_store_text_backfill.sql` | `UNKNOWN_NEEDS_EVIDENCE` | This is DML backfill; catalog/count evidence cannot prove text backfill completion without row sampling. |
| `20260424_store_subscriptions_canonical_alignment.sql` | `SAFE_TO_REPAIR_APPLIED` | Store subscription table, canonical columns, index, trigger, RLS, and member policy are present. |
| `20260501_platform_admin_console.sql` | `SAFE_TO_REPAIR_APPLIED` | Platform admin console tables and indexes are present with RLS enabled. |
| `20260503_public_site_operating_system.sql` | `SAFE_TO_REPAIR_APPLIED` | Platform public site CMS tables and indexes are present with RLS enabled. |
| `20260509_store_content_engine_mvp.sql` | `SAFE_TO_REPAIR_APPLIED` | Store content tables/indexes/triggers are present; later review hardening supersedes the earlier public review policy. |
| `20260510_review_request_links.sql` | `SAFE_TO_REPAIR_APPLIED` | Review request links table, indexes, trigger, RLS, and member policy are present. |
| `20260511_order_items_canonical.sql` | `SAFE_TO_REPAIR_APPLIED` | Order item canonical columns, indexes, RLS, and member policy are present. |
| `20260511_review_abuse_guard.sql` | `NEEDS_SCHEMA_APPLY` | `review_submit_attempts` table, indexes, and policy are missing. |
| `20260511_review_public_safety_hardening.sql` | `SAFE_TO_REPAIR_APPLIED` | Review request link hardening columns/index are present and public review policy removal is reflected. |
| `20260523_store_brand_theme_v2.sql` | `OBSOLETE_OR_DRAFT` | Migration targets legacy/absent `public_pages` and `store_requests`; current schema uses `store_public_pages`. |
| `20260603_store_oauth_credentials.sql` | `SAFE_TO_REPAIR_APPLIED` | OAuth credentials table, service-role policy, function, and trigger are present. |
| `20260609_lead_capture_requests.sql` | `SAFE_TO_REPAIR_APPLIED` | Lead capture target table, required columns, RLS, policies, indexes, trigger, and zero row count are confirmed. |

## Target Migration: `20260609_lead_capture_requests.sql`

Target-specific production evidence:
- `lead_capture_requests` exists.
- `lead_capture_requests_row_count`: `0`.
- Required canonical columns missing: `0`.
- Required canonical columns nullable: `0`.
- RLS enabled: `true`.
- Policy count: `5`.
- Index count: `3`.
- Trigger `trg_lead_capture_requests_set_updated_at`: present.

Required canonical columns present and not nullable:
- `source`
- `status`
- `store_name`
- `business_type`
- `main_concern`
- `desired_outcome`
- `data_readiness`
- `consent_marketing`
- `consent_contact`
- `created_at`
- `updated_at`

Lead-capture decision:
- Classification: `SAFE_TO_REPAIR_APPLIED`
- Standard migration apply: `BLOCKED`
- Single-version repair: `BLOCKED_BY_FULL_HISTORY_DRIFT`
- Reason: the target schema appears reflected, but repairing only `20260609` would leave 14 earlier local-only migrations unresolved and would produce an incomplete adoption story.

## Repair Sequence Recommendation

Repair sequence status: `REPAIR_SEQUENCE_BLOCKED`.

No concrete repair sequence is proposed in this PR.

A future repair sequence may be proposed only after one of these is true:
- Every local-only migration is classified as `SAFE_TO_REPAIR_APPLIED`.
- Or every non-safe migration is explicitly excluded or superseded through a separate owner-approved decision record.

Proposal template only:

```bash
# PROPOSAL TEMPLATE ONLY. DO NOT RUN FROM THIS PR.
npx supabase migration repair --status applied <VERSION> --linked
```

This template is documentation only. It is not an execution instruction, and this PR does not run migration repair.

## Blocked Items

Blocked by `NEEDS_SCHEMA_APPLY`:
- `20260405_mybiz_v2_phase1_phase2.sql`
- `20260406_mybiz_v2_phase3.sql`
- `20260511_review_abuse_guard.sql`

Blocked by `UNKNOWN_NEEDS_EVIDENCE`:
- `20260424_public_store_text_backfill.sql`

Blocked by `OBSOLETE_OR_DRAFT`:
- `20260523_store_brand_theme_v2.sql`

Blocked by duplicate version-prefix review:
- `20260424_public_store_text_backfill.sql`
- `20260424_store_subscriptions_canonical_alignment.sql`

Blocked operations in this PR:
- `npx supabase migration repair`
- `npx supabase db push`
- `npx supabase migration up`
- SQL migration body replay
- RLS policy apply
- GRANT/REVOKE
- live lead write enablement
- live customer memory write enablement
- env/auth/payment/webhook changes
- customer or lead data creation
- business table row creation/update/delete
- manual deploy

## Out-of-Scope Security Backlog

An unrelated RLS-disabled advisory remains a separate security backlog item. It is not caused by this adoption-plan PR and must not be mixed into migration-history repair. Any future RLS remediation needs its own approval, evidence pack, access-impact review, rollback plan, and tests.

## Production Launch Impact

User problem solved:
- Maintainers get a full migration-history inventory instead of a partial `20260609` repair path that could hide older drift.

Revenue path supported:
- Safer Supabase migration hygiene protects lead capture, customer memory, review automation, content engine, and paid operational workflows from future migration-history surprises.

Data that can be collected after separate approved work:
- Migration-history alignment evidence, schema-object evidence, and launch-gate readiness evidence. This PR collects no customer, lead, payment, or message row data.

Remaining before production launch:
- Resolve or explicitly supersede non-safe migrations.
- Re-run read-only evidence immediately before any future repair.
- Keep live lead writes and live customer memory writes disabled until their own launch checklist is approved.
- Use a separate security backlog item for unrelated RLS-disabled advisories.
