# MyBiz Stage 2 Verification

## R2.1 database certification — current

> Verified 2026-09-13 (Asia/Seoul) on GitHub-hosted `ubuntu-24.04` with an ephemeral Docker/Supabase stack. No Supabase project link, remote SQL, Production migration, Production database mutation, deploy, merge, real payment, signature or external publication occurred.

- `DATABASE_ENFORCEMENT_CERTIFIED=true`
- `RLS_RUNTIME_VERIFIED=true`
- `MIGRATION_REHEARSAL_PASS=true`
- `MIGRATION_PROMOTION_READY=false`
- `TECHNICAL_READY_FOR_MERGE=true`
- `HUMAN_PREVIEW_REVIEW_REQUIRED=true`
- `READY_FOR_MERGE=false`
- Initial passing run: [GitHub Actions 34754932251](https://github.com/mizzang0305-oss/mybizLab/actions/runs/34754932251), SHA `77fbfb57c1e5ce3701cae614b697aa4020c1a547`.

### Database runtime evidence

| Gate | Result | Evidence |
|---|---|---|
| Runner / container runtime | PASS | GitHub-hosted `ubuntu-24.04`; Docker Server `28.0.4` |
| Supabase CLI | PASS | Pinned `2.117.0`; command help checked before execution |
| Ephemeral database | PASS | PostgreSQL `17.6`; `supabase start` followed by clean `supabase db reset --local` |
| Baseline chain | PASS | CI-only production-shaped baseline fixture followed by all active repository migrations |
| Stage 2 draft rehearsal | PASS | Draft copied only to the runner temporary migration directory and applied after the baseline chain |
| pgTAP | PASS | `Files=1, Tests=25`, including 15 required negative and 8 required positive cases plus anon and cross-job boundary cases |
| Contract invariant | PASS | `DRAFT`/`SENT + WORK_READY` denied; `ACCEPTED`/`SIGNED` and `NOT_REQUIRED` paths allowed |
| Revision atomicity | PASS | `1 → 2`, concurrent revisions `2,3` with no duplicate, direct/skip/cross-job/cross-store denial |
| Role boundaries | PASS | `anon`, `authenticated` and `service_role` expectations exercised independently |
| Database lint | PASS | `No schema errors found` for `public,private` at warning level with errors fail-closed |
| Application gates | PASS | lint, typecheck, build, focused `60/60`, full regression `874/874`, Production dependency audit `0` |
| Remote mutation | PASS | `REMOTE_PROJECT_LINKED=0`, `REMOTE_DB_CONNECTION=0`, `REMOTE_SQL_EXECUTION=0`, `PRODUCTION_DB_MUTATION=0` |

The workflow is `.github/workflows/mybiz-stage2-db-certification.yml`. It uses `pull_request`, never `pull_request_target`, grants only `contents: read`, accepts no external secrets, runs one standard runner job, emits only a sanitized job summary, and destroys the temporary stack without retaining a database dump.

The Stage 2 SQL remains `supabase/migration_drafts/20260913083614_mybiz_stage2_service_os.sql`. Runtime rehearsal does not promote it into `supabase/migrations/`; Production migration remains a separate Owner gate.

## R2 pre-CI status — historical

> Verified 2026-09-13 (Asia/Seoul). Preview-only hardening; no Production deploy, database apply, real payment, signature, provider creation or external publication occurred.

- `READY_FOR_MERGE=false`
- `MIGRATION_PROMOTION_READY=false`
- Reason: the disposable local Supabase stack cannot start because this host has neither Docker nor Podman. Static contracts and a complete pgTAP matrix are ready, but actual PostgreSQL CHECK/RLS/GRANT execution remains `NOT_TESTED`.
- The R1 deployment `dpl_2XDpjunNKb7UQ5m2sJJmDNjZoJkF` is historical only. Its metadata (`gitCommitSha=17f84798...`, `gitDirty=1`) does not match PR #174 HEAD and is not R2 evidence.

### Hardening outcome

| Gate | Result | Evidence |
|---|---|---|
| PR #174 security diff | PASS_WITH_FINDINGS_FIXED_IN_R2 | Codex Security scan `3a22439a-8f8f-4a18-80d2-658b3e933f2b`; 14/14 changed source items; 3 Medium/high-confidence findings |
| Contract DB invariant | STATIC_PASS / DB_NOT_TESTED | Table CHECK rejects contract-required work states until `ACCEPTED` or `SIGNED` |
| Revision authority | STATIC_PASS / DB_NOT_TESTED | Authenticated revision INSERT removed; private atomic row-locked bump; composite revision FKs; current-revision asset policy |
| Confirmation replay | STATIC_PASS / DB_NOT_TESTED | one-time `consumed_at`, row lock, current revision binding and private service-role consume function |
| Object Storage | PASS_LOCAL | Actual filesystem bytes, one-time capabilities, allowlist/size ceiling, canonical tenant/job/revision key, overwrite/traversal protection, metadata and SHA-256 receipt verification |
| Dependency audit | PASS_RUNTIME / DEV_DEFERRED | Production audit 37 → 0; total 48 → 2. Remaining Vitest 3 + mocker require a major upgrade |
| Legacy baseline tests | FIXED | Both regex assertions use brace-aware extraction; assertions remain intact |
| Browser matrix | PASS_LOCAL_BUILD | 8 routes × 6 widths; no overflow, console issue, broken image, failed/4xx resource or refresh failure; keyboard focus and mobile actions present |
| Homepage interaction | PASS | 5 industry modes, Before/After range, confirmation/consent independence, merchant gate, Basic/Brand/Growth, optional contract and medical-default-OFF copy |
| Supabase local start | BLOCKED_ENVIRONMENT | `docker` and `podman` not found; local Postgres `127.0.0.1:54322` refused connection |

### Security findings closed in R2 code

1. Contract-required `DRAFT + WORK_READY` was allowed by the draft SQL. R2 adds an application-aligned table CHECK.
2. Authenticated clients could insert arbitrary revision numbers and attach assets to stale/future revisions. R2 removes that grant/policy, initializes revision 1 in a trigger, computes later revisions under a private atomic function, and adds composite FKs/current-revision checks.
3. Browser-supplied storage metadata could claim success without a byte receipt. R2 adds a dev/local adapter that completes `UPLOAD_INTENT → SIGNED_UPLOAD → OBJECT_EXISTS → SERVER_METADATA_VERIFY → HASH_VERIFY` before returning a receipt.

### Supabase rehearsal

Commands attempted only against `D:\MyProjects\mybizLab-stage2-r2-evidence-r1\supabase-local`:

```text
npx supabase --version
npx supabase init --workdir <isolated-local-dir> --yes
npx supabase db start --workdir <isolated-local-dir> --yes
npx supabase status --workdir <isolated-local-dir> --output json
npx supabase db lint --local --workdir <isolated-local-dir>
npx supabase db reset --local --workdir <isolated-local-dir> --yes
```

Observed: Supabase CLI `2.117.0`; `docker: command not found (podman also not found)`; local connection refused at `127.0.0.1:54322`. No project link, remote SQL, `db push`, migration apply or Production mutation occurred.

The exact 20-case local pgTAP matrix is in `supabase/tests/mybiz_stage2_service_os_rls.sql`. Because the database never started, all runtime RLS positive/negative cases are `NOT_TESTED`, not PASS. The migration remains in `supabase/migration_drafts/`.

### Browser and rollback

Browser scope: `360`, `390`, `430`, `768`, `1024`, `1440` over `/`, `/pricing`, `/onboarding`, `/demo/service-os`, both confirmation routes and both brand-site routes. Lazy route fallback reserves a viewport height and the invalid-link page keeps that minimum, reducing footer-driven layout shift. Playwright artifacts remain outside the repository.

- Database rollback: none; no apply occurred.
- Code rollback: revert R2 commits or close the R2 Draft PR.
- Dependency rollback: revert the isolated dependency commit if compatibility regresses.
- Next Owner gate: install/start Docker-compatible local runtime, then explicitly authorize fresh isolated `supabase db reset --local` and `supabase test db --local`. Production migration remains a separate gate.

## R1 historical result — superseded by R2 above

> Verified: 2026-09-13 Asia/Seoul. Preview only; no Production deploy, database apply, real payment, signature or external publication occurred.

## Outcome

| Gate | Result | Evidence |
|---|---|---|
| Stage 2 policy tests | PASS | `npx vitest run src/tests/service-os-policy.test.ts src/tests/service-os-migration-contract.test.ts src/tests/service-os-pages.test.ts src/tests/marketing-pages.test.ts` → 4 files, 41 tests |
| Lint | PASS | `npm run lint` |
| Typecheck | PASS | `npm run typecheck` |
| Production build | PASS | `npm run build`; 3,225 modules transformed |
| Full regression | BASELINE_FAIL_ONLY | 149 files / 853 tests passed; 2 pre-existing customer-memory regex-extraction assertions failed |
| Browser console | PASS | 0 errors, 0 warnings across the Stage 2 demo routes |
| Responsive overflow | PASS | 360, 390, 430, 768, 1024 and 1440 CSS widths; `scrollWidth === clientWidth` at each measured viewport |
| Vercel Preview build | PASS | `vercel deploy . -y`; Preview build completed |
| Preview runtime fetch | NOT_TESTED | Deployment skill forbids a follow-up fetch/curl; local browser QA covers the routes below |
| Supabase apply | NOT_RUN | Draft is outside `supabase/migrations/`; no local or remote database write |

## Browser flows

- `/`: interactive scene tabs, industry selector, synthetic before/after control, independent confirmation/consent/merchant approval, website tier and module builder.
- `/demo/service-os`: optional-contract job creation, provider-disabled evidence, content candidate progression and payment separation.
- `/confirm/:token`: valid synthetic token flow, independent completion/marketing consent, correction reset and `PAYMENT_NOT_REQUESTED` preservation.
- `/confirm/invalid`: fail-closed invalid-link state.
- `/site/cleaning-studio`: approved synthetic portfolio preview.
- `/site/hair-studio`: no-consent empty state; no portfolio leakage.

Screenshots are kept outside the repository under `D:\MyProjects\mybizLab-stage2-evidence\visual` to avoid adding large generated artifacts to source control.

## Preview

- URL: `https://mybizlab-glol43m13-mizzang0305-gmailcoms-projects.vercel.app`
- Target: existing Vercel project `mybizlab`.
- Production domains were not changed.

## Known baseline and provider gaps

- The two full-suite failures existed before Stage 2 and are limited to regex extraction of the customer-memory contact-only harness block.
- Object Storage, signature provider, real payment request execution and social publication remain disabled or unbound for this slice.
- The Vercel install log reports 48 dependency audit findings (1 low, 31 moderate, 12 high, 4 critical). Stage 2 added no dependency; remediation needs a separately scoped dependency-risk review.
- The SQL file is a review draft only. It uses explicit grants, RLS and a server-only boundary for confirmation, consent, payment and publication mutations, but still requires local database rehearsal before any apply approval.

## Rollback

- Code/docs: revert the Stage 2 commit.
- Preview: it is isolated from Production; remove the Preview deployment in Vercel if cleanup is desired.
- Database: no rollback is required because no migration was applied.
