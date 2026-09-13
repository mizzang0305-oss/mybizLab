# MyBiz Stage 2 Dependency Audit

> Audited 2026-09-13 (Asia/Seoul) from `package-lock.json`. No `npm audit fix`, major upgrade, Production deploy, or provider change was performed.

## Result

| Scope | Before | After |
|---|---:|---:|
| All dependencies | 48 (critical 4, high 12, moderate 31, low 1) | 2 (critical 1, moderate 1) |
| Production dependencies (`--omit=dev`) | 37 (critical 3, high 6, moderate 28) | **0** |

The two remaining findings are the same Vitest 3 toolchain issue: direct `vitest@3.2.4` and transitive `@vitest/mocker@3.2.4`. The fix requires Vitest `>=4.1.11`, a major upgrade, so it is classified `DEV_ONLY` + `REQUIRES_MAJOR_UPGRADE` and deferred to an isolated compatibility change. Tests run through non-listening `vitest run`; the vulnerable UI server is not started by repository scripts. This reduces current reachability but is not a false-positive or a remediation.

## Critical triage

| Package / installed | Class | Advisory / path | Fix and outcome |
|---|---|---|---|
| `jspdf@4.2.0` | `DIRECT_RUNTIME`, PDF generation | GHSA-7x6v-j9x4-qf24; GHSA-wfv2-pwc8-crg5; root → jspdf | `4.2.1`; `SAFE_PATCH_AVAILABLE`; fixed |
| `protobufjs@7.5.4` | `TRANSITIVE_RUNTIME`, GenAI/Firebase serialization | GHSA-xq3m-2v4x-88gg and related protobuf code-generation/DoS advisories; root → `@google/genai` / Firebase → protobufjs | `7.6.6`; parent ranges allowed patch; fixed |
| `websocket-driver@0.7.4` | `TRANSITIVE_RUNTIME`, Firebase realtime path | GHSA-mp7j-qc5w-4988; GHSA-xv26-6w52-cph6; root → firebase → database → faye-websocket | `0.7.5`; parent range allowed patch; fixed |
| `vitest@3.2.4` | `DEV_ONLY`, `REQUIRES_MAJOR_UPGRADE` | GHSA-5xrq-8626-4rwp; GHSA-82fw-gwwq-j7x9; root dev tool | safe line is `>=4.1.11`; deferred, not hidden |

## High triage

| Package / installed | Class and dependency path | Fix and outcome |
|---|---|---|
| `@grpc/grpc-js@1.9.15` | `TRANSITIVE_RUNTIME`; Firebase → Firestore | `1.9.16`; fixed within `~1.9.0` |
| `@tiptap/core@3.23.6` | `TRANSITIVE_RUNTIME` of direct Tiptap editor packages; prototype/Markdown ReDoS advisories | synchronized Tiptap packages at `3.31.3`; fixed |
| `brace-expansion@1.1.12/2.0.2/5.0.4` | mixed `TRANSITIVE_RUNTIME` and `DEV_ONLY`; GenAI auth tooling, ESLint/glob | `1.1.18/2.1.4/5.0.9`; fixed within parent ranges |
| `browserslist@4.28.1` | `DEV_ONLY`; Babel/PostCSS build chain | `4.28.9`; fixed |
| `js-yaml@4.1.1` | `DEV_ONLY`; ESLint config parsing | `4.3.2`; fixed |
| `nanoid@3.3.11` | `DEV_ONLY`; PostCSS build chain | `3.3.19`; fixed |
| `picomatch@4.0.3` | `DEV_ONLY`; Vite/glob matching | `4.0.7`; fixed |
| `postcss@8.5.8` | `DEV_ONLY`; CSS build chain | `8.5.28`; fixed |
| `react-router@7.13.1` | `TRANSITIVE_RUNTIME` of direct router | `7.18.3`; fixed |
| `react-router-dom@7.13.1` | `DIRECT_RUNTIME`; application router | `7.18.3`; fixed |
| `vite@6.4.1` | `DEV_ONLY`; build/dev server | `6.4.3`; fixed |
| `ws@8.19.0` | `TRANSITIVE_RUNTIME`; GenAI and Supabase Realtime | `8.21.3`; fixed |

Advisory details were obtained from the `npm audit --json` records, including the package ranges and GitHub advisory URLs. The lockfile-only refresh also moved safe vulnerable transitive packages such as `dompurify` and `fflate` into fixed versions; no override was required.

## Commands and guardrails

```text
npm audit --json
npm audit --omit=dev --json
npm explain <package>
npm install --package-lock-only --ignore-scripts --no-audit --no-fund <targeted direct packages>
npm update --package-lock-only --ignore-scripts --no-audit --no-fund <targeted transitive packages>
npm ci --ignore-scripts --no-audit --no-fund
```

- Broad `npm audit fix` was not used.
- The remaining Vitest major upgrade must run in a separate branch/commit with full test, browser and CI compatibility verification.
- Final acceptance still depends on lint, typecheck, build, full regression and browser QA after the lock refresh.
