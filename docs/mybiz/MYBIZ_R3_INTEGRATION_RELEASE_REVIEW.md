# MyBiz R3 integrated release review — Draft PR #186

Status: **partial, Owner review only**. This document links executable draft artifacts; it is not Production change approval. Security base PR #185: `3155a1e4e274db4a5ac18380e137dc216bb3dbda`. Showroom upstream PR #181: `d84dd4bfe44ae3f1f27926ef0211627f1577a3cb`. PR #183/#184/#185/#181 and the original dirty checkout remain unchanged. Integration writer: isolated `codex/mybiz-r3-security-design-factory-integration` worktree and Draft PR [#186](https://github.com/mizzang0305-oss/mybizLab/pull/186).

## Security repair and evidence

- Root defect: authenticated callers could directly invoke old `SECURITY DEFINER` store creation with `p_plan=vip`, bypassing the server payment gate; the old server service-role path lacked `auth.uid()` and failed normal provisioning. The old behavior is reproduced only with synthetic local Auth.
- Draft SQL: `supabase/migration_drafts/20260923102833_mybiz_r3_provisioning_rpc_boundary.sql`. It revokes all old overloads, grants a distinct service-only wrapper, resolves an active Auth/core identity and explicit/exact-ID public actor, enforces one free store per actor, and atomically creates store, membership, subscription, defaults and an idempotency receipt. No live migration was promoted.
- Server: `api/stores/provision.ts` verifies bearer Auth, rejects caller actor/payment assertions, checks the paid launch gate, binds provider payment to actor/request/plan/product/amount/currency, then calls the service-only RPC. `src/server/billingCheckout.ts` binds onboarding checkout custom data to a verified Auth actor; `src/shared/lib/portoneCheckout.ts` sends the bearer for this checkout.
- Browser: `src/shared/lib/services/mvpService.ts` forwards Auth bearer and stable request key; the pre-existing FREE UI marker is not sent as a payment receipt. The onboarding page shows the sign-in prerequisite without claiming a completed activation.
- [Two-run local Supabase evidence at code SHA `4c3880d`](https://github.com/mizzang0305-oss/mybizLab/actions/runs/35853542954): actual local Auth JWT, Kong/PostgREST, service role and MyBiz handler tests passed. Each run had 255 Data API assertions, 8 repaired-RPC ACL assertions, 8 MyBiz handler tests and rollback checks. Local Security Advisors went from baseline `ERROR=3/WARN=1` to candidate `ERROR=1/WARN=1`, with no new ERROR. Source-only or mock-only tests are not substituted for this runtime proof. Production catalog was queried for metadata only; no Production row/credential was returned.

## HTTP and external coverage

| Boundary | Executed evidence | Remaining limit |
|---|---|---|
| 15-table direct Data API | 255 assertions × 2 clean disposable stacks; own/cross/nonmember, anon/service and rollback | Production permissions unchanged |
| Provisioning RPC | old bypass reproduced before fix; after fix 8 ACL checks × 2 and actual free/paid handler paths | local synthetic only; no real payment or Production identity |
| Public/merchant selected routes | real handler wrapper: snapshot, legacy order, setup request and merchant member/wrong-store | canonical public page, visitor-session, public order state, browser `mvpService`, expired/nonmember merchant not executed end-to-end |
| Admin/webhook | source trust boundary and existing unit tests | actual local signed webhook, replay and platform-admin HTTP not run in this R3 suite |
| External 7 tables | repo/workflow, DB dependency and Edge Function metadata inspected | Vercel deployed-function inventory and out-of-repo worker attestation missing; seven remain `UNVERIFIED` |

See [HTTP matrix](PRODUCTION_15_TABLE_HTTP_COMPATIBILITY.md) and [consumer inventory](PRODUCTION_15_TABLE_EXTERNAL_CONSUMERS.md). `store_analytics_profile` (singular) and `store_analytics_profiles` (plural), and `public.sessions` versus `auth.sessions`, are separate objects.

## Design Factory and visual boundary

Read-only Factory source: `D:\MyProjects\MINZ_DESIGN_FACTORY` at `9542e711e600572a8c06fb57611c107dd8d672e8`. The two internal DNA metadata references and SHA-256 values are pinned in [consumer manifest](FACTORY_CONSUMER_MANIFEST.json). Actual public build-time export/import and commercial redistribution rights were **not verified**; no Factory code, paid component or media was copied. MyBiz-owned Quiet Editorial/Ops Precision internal-preview choices render in the existing Vite landing and enter the existing consultation summary. Factory canonical registry is untouched; live sync is `NOT_CONNECTED`; commercial release is held.

The integrated landing retains 6 templates, 8 scroll scenes, 3 original motion candidates, existing five-vertical Service OS media, and the human review gate. Local browser verification covers 7 viewports, 10 interactions, explicit video loading/error fallback, reduced motion, keyboard/touch-size checks, 20 remounts, form text preservation, and no actual email send. Browser captures stay outside Git under `D:\CodexData\.codex\tmp\mybiz-r3-integrated-browser`.

## Rollout and rollback contract — not executed

| Combination | Provisioning consequence | Release handling |
|---|---|---|
| OLD_APP + OLD_DB | Direct VIP RPC bypass; normal server path fails | Current risky baseline; do not call this safe |
| OLD_APP + NEW_DB | Old RPC denied, old app cannot provision | Explicit provisioning HOLD until server cutover |
| NEW_APP + OLD_DB | New RPC absent, provisioning fails closed | Explicit provisioning HOLD; do not reopen old EXECUTE |
| NEW_APP + NEW_DB | Local synthetic free/paid and deny matrix passes | Separate Owner-approved apply, exact catalog precheck and Production synthetic canary required |

Operational sequence must be separately approved: verify exact SQL/source hashes and current ACL/catalog; announce provisioning HOLD; apply only the bounded RPC repair once; cut over the matching app; read-only ACL checks plus separately authorized synthetic canary; remove HOLD only after proof. The 15-table GRANT/RLS candidate is a **separate** release unit. Rollback of this source diff is a normal revert, but Production rollback must not automatically restore broad CRUD or the unsafe authenticated old RPC. If a cutover fails, keep provisioning on HOLD and forward-fix. Never drop/truncate business rows or identity bindings after use.

## Owner decisions

| Change target | Status | Exact artifact | Risk / missing approval |
|---|---|---|---|
| RPC ACL + server provisioning | local synthetic repair; Production HOLD | draft SQL, `api/stores/provision.ts`, local run above | separate Production DB/function ACL and app deployment approval; exact precheck/canary |
| First-time onboarding identity | blocked for anonymous activation | `/onboarding`, `/login` | no self-registration path; Owner must choose controlled account issuance or separately designed signup |
| Non-exact manually bound business profile | not certified in browser postcheck | `mvpService.ts` membership verification | current exact-ID bindings work; separate identity-route/policy design before enabling legacy manual binding |
| Design showroom / Factory | MyBiz local Preview only | Factory manifest, landing, browser capture | Factory export contract, ownership/license and Owner visual review before commercial release |
| 15-table RLS/GRANT | blocked | PR #184 candidate + PR #185 HTTP evidence | seven external consumers and full route matrix still open; separate Owner apply gate |

Customer problem solved in this draft: authorized existing accounts can provision through one reviewed boundary; a homepage buyer can select template, motion and style without losing request text. Revenue path is SaaS onboarding and website-build consultation, but no real payment or mail was run. No new customer data collection is activated by this PR. Before launch: close the explicit Owner gates above and review the exact-head Preview.
