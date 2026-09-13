# MyBiz Stage 2 P00 Baseline

> Captured: 2026-09-13 Asia/Seoul. Secret values were not read.

## Repository identity

| Field | Observed value |
|---|---|
| Repository | `D:\MyProjects\mybizLab-stage2-orchestra-r1` |
| Remote | `https://github.com/mizzang0305-oss/mybizLab.git` |
| Continuation branch | `codex/mybiz-stage2-orchestra-r1` |
| Baseline | `origin/codex/mybiz-field-saas-home-v1` at `17f84798b498909798dc25a8075aabd8bf5c0ee7` |
| Default branch | `main`; remote HEAD `267ea722ccedc881909cb8c543966cdfc82a495d` |
| Feature divergence | `0` behind / `6` ahead of `origin/main` |
| Isolated baseline status | clean; staged `0`, modified `0`, untracked `0` |
| Preserved original worktree | `D:\MyProjects\mybizLab`, branch `codex/post-pilot-integration-approval-matrix`, HEAD `a65eacb636e465de11f8ec1f27779c62f53eccbc` |
| Original dirty baseline | six untracked entries under `.local/`, `.playwright-mcp/`, and `AGENTS.md`; not edited |

## Runtime and toolchain

- Node `v24.14.0`, npm `11.9.0`, Git `2.53.0.windows.1`.
- Package manager: npm, pinned by `package-lock.json`.
- Framework: React `^19.0.0`, React Router `^7.9.3`, Vite `^6.4.1`, TypeScript `~5.8.2`, Tailwind `^4.1.14`, Vitest `^3.2.4`.
- Existing motion libraries: `motion`, `gsap`, `lenis`; no new dependency is required for Stage 2.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `clean`, and the customer-memory dry-run harness.
- Dependency bootstrap: `npm ci --ignore-scripts --no-audit --no-fund`, 572 packages installed in the isolated worktree.

## Baseline validation

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` | FAIL: 825 passed, 5 failed, 830 total; 145 files passed, 3 failed |

The five pre-change failures were two customer-memory documentation/harness extraction assertions and three stale marketing-page assertions left behind by the partial landing branch. These are recorded as baseline failures, not Stage 2 regressions.

## Existing product assets

- Public: `/`, pricing, onboarding, login, feature/case/FAQ/about/contact/trust, legal and update pages.
- Merchant: dashboard, customers, reservations, schedules, orders, waiting, contracts, content, brand, analytics and billing surfaces.
- Contracts: CRUD and file URL/metadata storage with `draft/sent/signed`; no verified external signature provider.
- Subscription billing: PortOne client/server verification and webhook paths already exist. Stage 2 does not alter them.
- Customer payment: existing order payment state exists, but no verified generic service-job collection provider.
- Data: demo repository plus Supabase runtime; Firebase client and adapter remain present.
- Storage: Firebase/Supabase dependencies exist, but no verified object-storage provider is bound for Stage 2 evidence uploads.
- Database: three active baseline/customer-memory migrations and archived historical migrations. The Stage 2 schema proposal is additive, draft-only, and intentionally stored under `supabase/migration_drafts/` so the active migration set remains unchanged.
- Brand/content: store home content, themes, reviews, blog/media, social draft jobs and approval-first provider foundations already exist.
- Landing branch: a decomposed MyBiz Field landing with workflow data, vertical catalog and demo modal; reused and widened to Service OS.

## Environment and deployment hints

- Only `.env.example` exists in the isolated worktree. Names cover public app URL, data provider, Firebase, PortOne, Supabase and AI providers; values were not read.
- `vercel.json` exists. `.vercel/project.json` is absent in the isolated worktree, so no Vercel target identity is established yet.
- No deployment, remote database read, migration apply, payment, signature, or social publication occurred during P00.

## Public surface before Stage 2 continuation

- Root copy was narrowed to “MyBiz Field” and field-service verticals.
- Pricing remained routed to the existing server-backed public pricing surface.
- Customer confirmation was a static visual sample; there was no scoped demo route.
- Jobs, evidence revisions, confirmation links and multi-tenant brand sites had no dedicated Stage 2 domain contract.

## Safety boundary

The source worktree is isolated. Production deploy, main merge, Production DB migration, paid product or price changes, external publishing, new paid resources, custom-domain purchase, legal finalization and medical publication remain Owner Gates.
