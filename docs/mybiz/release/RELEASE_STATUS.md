# MyBiz release closure status

Observed through: 2026-09-25 12:07 KST. This is a release checkpoint, not a launch approval.

## Decision

- `OVERALL_RESULT=BLOCKED`; `FINAL_CERTIFICATION=NOT_CERTIFIED`.
- Strong paid acquisition and the next large phase remain on hold. Manual pilot outreach has a separate, narrower approval and is not a live-data or delivery approval.
- Production is still source `41ae32991412d720683ffc1ac0a82f474a2c47ac` on Vercel deployment `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5`. It does not include open Draft PRs #181, #182, or #187.
- The tested code checkpoint is `19bcf6112bb253144fd7ee17ec75c9aed9dbe453` on isolated branch `codex/mybiz-release-closure-r1`. This evidence-only documentation may create a later local HEAD without changing the tested runtime code. Neither is pushed, deployed, or certified.
- The Supabase project `plnuyudyogbzwpmdulnw` is active in `ap-northeast-2`; its relationship to the currently deployed client and server runtime is not yet verified. The provided password file exists, but its value was not read or disclosed.

## Gate register

| Gate | Status | Current evidence and missing proof |
| --- | --- | --- |
| G01 identity/schema | BLOCKED | Production alias and source verified. Candidate DB catalog inspected, but deployed frontend/server DB target, live migration compatibility, and same-release identity are not proven. |
| G02 Auth/session/membership | BLOCKED | Existing service-role email fallback could conflate accounts. Local candidate fails closed for exact-ID profiles; explicit non-identical auth/profile bindings, real sessions, revocation, and role paths remain unverified. |
| G03 persistence/reread | BLOCKED | Local tests do not establish a committed Production row or independent reread. No Production write canary was authorized. |
| G04 grants/RLS/tenant isolation | FAIL | Candidate project's live catalog has 15 `public` base tables with RLS disabled and `anon` CRUD table privileges. Actual Data API exposure and row access were not tested; two-store user-path isolation is unproven. |
| G05 errors/health | FAIL | Anonymous Production `/api/health` did not return headers within 8 seconds. PR #182 and local candidate address response completion; local candidate also sanitizes health/public API errors, but neither is deployed. |
| G06 privacy/consent | BLOCKED | Actual field inventory, retention/operator facts, withdrawal workflow, and current counsel/Owner decisions are not verified. |
| G07 inquiry/consultation | BLOCKED | Synthetic tests pass; real approved request, consent, commit, authorized administrative reread, and follow-up are not verified. Payment is out of this minimal path. |
| G08 mobile journey | NOT_TESTED | Public HTTP status does not verify 360/390/430px login-to-admin journey. No approved real account or Production write path was used. |
| G09 logs/Analytics | BLOCKED | Local correlation IDs cover one error path only. Operator-visible Production error/save/reread/conversion evidence and test-traffic exclusion are not verified. |
| G10 backup/restore/rollback | BLOCKED | Candidate Supabase organization reports Free plan. No verified protected backup or isolated restore; Storage/Auth/external-setting coverage is unknown. No backup/export/restore was performed. |
| G11 pilot onboarding | BLOCKED | Real account, store binding, multi-store isolation, saved work, recovery, and support path are not proven in Production. Actual onboarded/tested store counts are UNKNOWN. |

Details and machine-readable status: `release-evidence.json`.

The 15 catalog findings are `ai_briefing_logs`, `ai_reports`, `events`, `menu_categories`, `menu_items`, `orders`, `sessions`, `store_analytics_profile`, `store_daily_metrics`, `store_home_content`, `store_modules`, `store_priority_settings`, `store_setup_requests`, `store_staff`, and `store_tables`. Object ownership and actual API exposure must be confirmed before defining a MyBiz-only remediation allowlist. PR #187's two-table draft does not cover the other 13.

## Highest-priority blockers

1. **Security, G04 (TECHNICAL + AUTHORIZATION):** Inventory the exact MyBiz-owned API schema and all affected grants/policies. Prepare and review a minimal, backward-compatible RLS/GRANT fix in isolation. Production DDL/GRANT needs separate approval, identity fingerprint match, and G10 recovery proof. Do not use RLS OFF, broad grants, or browser service-role access as a workaround.
2. **Identity/Auth, G01/G02 (TECHNICAL + OWNER_FACT_REQUIRED):** Bind the live deployment to its actual Supabase target and verify the `auth.uid()` to public profile mapping. Local exact-ID fail-closed behavior may deny legitimate non-identical bindings; it must not be promoted as a complete Auth fix.
3. **Runtime, G05 (TECHNICAL + AUTHORIZATION):** Review the integrated local source, preserve PR #181's exact-HEAD approval, and obtain separate authorization for any new remote change or merge/deploy. Verify `/api/health` on the exact Production source after deployment.
4. **Recovery and real path, G10/G03/G07/G11 (AUTHORIZATION + OWNER_FACT_REQUIRED):** Confirm a permitted backup method and isolated restore. Only then define approved account, store, fixture marker, row cap, retention/cleanup, and real-path canary scope. Do not silently use production customer data.

## Verified boundaries

- PR #181 Owner approval exists for its then-current showroom head only; it does not approve the new integrated code, DB, or Auth changes. PR #182 and #187 remain Draft. PR #148 was not modified.
- Local lint, typecheck, full test (`946 passed`, `14 skipped`), and build passed on the integrated tree. Build emitted chunking warnings. Full-stack skips are not Production evidence.
- Anonymous status-only GET: `/`, `/pricing`, `/robots.txt`, `/sitemap.xml`, and `/dashboard/customers` returned HTTP 200. The dashboard response may be the SPA shell, so it is not an Auth pass. No response body or customer row was inspected.
- The public Production entry bundle contained neither the candidate Supabase ref nor a literal Supabase hostname. This non-sensitive static probe cannot establish the deployed client/server DB target.
- No Production DDL/DML, Auth/membership mutation, secret disclosure, backup/export, deploy, real payment, or external message was executed by this task.
- Backup capability and scope must be verified for the actual runtime project; [Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups) does not treat a Free-plan project as having an automatic daily backup or include Storage objects in a database backup.

## Resume point

Review the local candidate and current gate evidence. Before any remote or Production action, verify the exact Owner approval for that specific diff and side effect. First close G01 identity and G10 recovery, then G04/G02 in an isolated fixture environment, then authorize a bounded Production canary. Re-check every affected gate against one deployed SHA before certification.
