# MyBiz RLS compatibility gate

Date: 2026-09-26
Status: analysis in progress
Branch: security/mybiz-rls-compat-v1
Production target: Mybiz Project (plnuyudyogbzwpmdulnw)

## Purpose

Biz2Lab Commercial Production is on hold because the shared MyBiz database has 15 public-schema tables with RLS disabled. This branch exists to design and validate a compatibility-safe hardening change without touching Production.

## Verified affected tables

- store_tables
- sessions
- orders
- events
- menu_categories
- menu_items
- store_staff
- store_modules
- ai_briefing_logs
- store_analytics_profile
- store_priority_settings
- store_daily_metrics
- ai_reports
- store_home_content
- store_setup_requests

## Initial compatibility notes

- orders: active server APIs plus legacy browser compatibility path; migration required before hardening.
- sessions: active server path; broad public table access is not justified by current code evidence.
- store_tables, menu_categories, menu_items: browser provisioning compatibility exists; trace before changing DB permissions.
- store_priority_settings: browser authenticated use exists; target should be store-member scoped.
- store_home_content: legacy fallback behind canonical public-page storage; keep table but quarantine if fallback is no longer needed.
- store_setup_requests: browser submission and server administration both exist; move submission to a safe server boundary or add narrow policy before enabling RLS.
- several AI/analytics/staff/module tables have no direct current table call in the initial search and require legacy/dependency verification.

## Safety boundary

This branch must not:
- change the Production database
- blanket-enable RLS without compatible policies
- break public ordering, onboarding, or merchant dashboard flows
- expose privileged server credentials to the browser
- modify Biz2Lab PR #130
- start AgentOps work

## Required gate

Before Production approval:
1. classify all 15 tables by real runtime access;
2. remove unnecessary anonymous writes;
3. define store-member policies for merchant-private data;
4. move public mutations behind server APIs where practical;
5. validate on disposable Supabase;
6. verify public, onboarding, merchant, and cross-store regression;
7. prepare exact migration and rollback evidence.

Target certification: MYBIZ_PRODUCTION_SECURITY_APPROVAL_READY.
