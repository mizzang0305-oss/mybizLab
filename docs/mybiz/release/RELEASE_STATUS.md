# MyBiz release closure status

Observed through: 2026-09-25 21:10 KST. This is a release checkpoint, not a launch approval.

## Decision

- `OVERALL_RESULT=BLOCKED`; `FINAL_CERTIFICATION=NOT_CERTIFIED`.
- Strong paid acquisition and the next large phase remain on hold. Manual pilot outreach has a separate, narrower approval and is not a live-data or delivery approval.
- Production is still source `41ae32991412d720683ffc1ac0a82f474a2c47ac` on Vercel deployment `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5`. It does not include open Draft PRs #181, #182, or #187.
- This restricted continuation resumed clean local HEAD `8133d4661274c5c7a42888fccc8dace0e2f59a7e` on isolated branch `codex/mybiz-release-closure-r1`; the branch has no remote ref. Auth resolver, exact-branch CI/deployment configuration, isolated tests and evidence are local only. The candidate remains unpushed, undeployed, and uncertified.
- The Supabase project `plnuyudyogbzwpmdulnw` is active in `ap-northeast-2`; its relationship to the currently deployed client and server runtime is not yet verified. The provided password file exists, but its value was not read or disclosed.

## Gate register

| Gate | Status | Current evidence and missing proof |
| --- | --- | --- |
| G01 identity/schema | BLOCKED | `www.mybiz.ai.kr` resolves to the same Vercel deployment/source. A lazy-loaded deployed browser chunk contains candidate ref `plnuyudyogbzwpmdulnw`; this is static client configuration, not a server DB connection or actual provider request. Deployment-time server target and live schema compatibility remain unproven. The supplied env file contains a password key only, without a host/ref. |
| G02 Auth/session/membership | BLOCKED | A failing HTTP-handler unit test reproduced the legitimate non-identical binding 403. The local candidate now uses a service-role-only resolver draft and checks real memberships; 15 targeted unit tests pass. Real local Auth JWT/server/PostgREST positive and negative matrix remains NOT_RUN because this host lacks Docker/psql. No Production binding or membership was written. |
| G03 persistence/reread | BLOCKED | Local tests do not establish a committed Production row or independent reread. No Production write canary was authorized. |
| G04 grants/RLS/tenant isolation | FAIL | Repeated read-only catalog query: all 15 `public` base tables still have RLS OFF and `anon` CRUD. `store_setup_requests` has SELECT/UPDATE ownership policies, but RLS OFF makes them ineffective. Actual Data API exposure, unauthorized row access, and two-store path isolation are unproven. PR #187 covers only two tables and is not applied. |
| G05 errors/health | FAIL | Production anonymous `/api/health` again returned no headers before an 8-second timeout. Local actual Node HTTP tests now cover missing env, successful read, fetch/body hangs, invalid body, upstream error and 405; the 5-second bound covers fetch **and body**. This local fix is not deployed. |
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
- Current local lint, typecheck, full test (`952 passed`, `19 skipped`) and build passed. The original 14 skipped tests consist of ten RPC and four R5 two-table tests; five new Auth matrix cases bring the local skip count to 19. They require `LOCAL_SUPABASE_STATUS_FILE` and isolated CLI/Docker/psql. The host lacks Docker and psql; GitHub run [35969001195](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35969001195) passed for earlier `8904cb1`, not this candidate. Build emitted chunking warnings.
- The RPC workflow now allowlists only the added R1 push branch and records exact checkout SHA. `vercel.json` has an exact R1 `git.deploymentEnabled=false` rule; project Root Directory is `.`. Vercel documents this rule, but no remote R1 branch exists and the actual automatic deployment suppression cannot be observed before push. Under the Owner's pre-push condition, remote push and GitHub-hosted CI remain NOT_RUN; no Preview was requested.
- Anonymous status-only GET: `/`, `/pricing`, `/robots.txt`, `/sitemap.xml`, and `/dashboard/customers` returned HTTP 200. The dashboard response may be the SPA shell, so it is not an Auth pass. No response body or customer row was inspected.
- The public Production entry bundle lacks a literal Supabase hostname, but its lazy `cinematic-experience` chunk contains `plnuyudyogbzwpmdulnw.supabase.co`. No actual browser request or server runtime binding was observed; the real data provider remains unverified.
- No Production DDL/DML, Auth/membership mutation, secret disclosure, backup/export, deploy, real payment, or external message was executed by this task.
- Backup capability and scope must be verified for the actual runtime project; [Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups) does not treat a Free-plan project as having an automatic daily backup or include Storage objects in a database backup.

## Resume point

Review the exact local candidate and static Vercel branch rule. Obtain an independently verifiable pre-push exact-R1 deployment block or Owner direction that treats the documented branch rule plus root/config validation as sufficient for the authorized single push. Then run the existing GitHub-hosted isolated CI on the exact candidate SHA; do not substitute the earlier run. G01 identity and G10 recovery remain separate Production gates. Re-check every affected gate against one deployed SHA before certification.
