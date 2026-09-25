# MyBiz release operations runbook

This runbook is an approval-gated procedure. It is not authority to run SQL, deploy, create users, copy customer data, or send messages.

## Stop conditions

- Stop on a mismatch among domain, Vercel Production deployment/source, frontend/server Supabase target, approved project ref, and current schema/permission fingerprint.
- Stop on unknown MyBiz object ownership, concurrent schema drift, missing safe backup/restore evidence, missing exact approval, or any real PII appearing in a test artifact.
- Stop on an RLS-disabled or over-granted exposed table, failed A/B tenancy check, or a successful UI response without a committed/reread row.
- Do not compensate by weakening RLS, using a browser service-role key, broadening a write gate, or bypassing a security denial.

## Read-only re-anchor

1. Record git worktree/branch/HEAD, remote PR states and approved heads, Production domain alias/deployment/source, and protected untracked paths. Preserve other worktrees and PR #148.
2. Inspect project metadata and deployed-time config through approved read-only interfaces. Never print env values or the protected password. Confirm both client and server DB refs from sanitized runtime/config evidence.
3. Query catalog metadata only with a read-only transaction and timeout where supported. Capture MyBiz-owned schema shape, roles, grants, policies, functions, migration history, and a secret-free fingerprint. Do not query customer rows to prove identity.
4. Compare code-referenced objects with live catalog and classify each as DOCUMENTED, CODE_REFERENCED, LIVE_PRESENT, or RUNTIME_VERIFIED.

## Controlled remediation sequence

1. Reproduce each defect, add a failing regression test, make the smallest correction, and rerun targeted plus integrated lint/typecheck/test/build. The current local candidate is not a substitute for a reviewed PR.
2. Determine an actual backup path and isolated restore destination before any Production schema/security change. Record backup age, retention, roles/Auth/Storage/external-setting exclusions, and measured restore result. A schema+synthetic fixture rehearsal must be labeled as such.
3. In isolation, verify two-store owner/staff/nonmember fixtures, anonymous access denial, profile binding, child/parent tenancy, and both old/new rows on updates. Review exact migration and rollback with an independent reviewer.
4. Obtain separate Owner approval for the exact push/PR, merge/deploy, Production DDL/DML/GRANT, Auth/fixture, backup/export/restore, and any bounded Production write/cleanup. Existing approval of a different head or action does not transfer.
5. Immediately before approved application, recheck Production identity, source and schema fingerprint, backup/restore evidence, and the approved diff. Use a single executor, transaction/lock-timeout where safe, and stop on drift or partial failure.
6. After approved deployment, verify domain -> deployment -> source SHA -> runtime DB ref and repeat affected gate tests. A Preview or synthetic pass cannot certify Production.
7. A Production canary, if separately approved, uses only the approved account/store/marker/row limit. Compare request receipt, commit, fresh-session privileged reread, customer memory link, duplicate retry, and support/log trace without emitting raw PII. Cleanup is a separate approved action.

## Rollback and containment

- Local code candidate: revert only the named local commit or worktree files after checking for later work; do not reset, clean, delete branches, or touch another checkout.
- App deploy: use a previously approved known-good source/deployment only after checking DB compatibility. Pause the affected write entry point if the new app cannot safely operate.
- DB permissions: restore the previously reviewed safe policy/grant set or block the affected route. Never restore RLS OFF or anonymous CRUD as a rollback shortcut.
- Incident: stop new writes/sends, record non-PII event and deployment IDs, preserve evidence, assess affected tenants and legal/privacy notification duties with Owner. Do not export customer rows without separate approval.

## Current checkpoint

The isolated candidate source is `19bcf6112bb253144fd7ee17ec75c9aed9dbe453`; Production remains `41ae32991412d720683ffc1ac0a82f474a2c47ac` on `dpl_5TmFPDjCc5PP7zuRdtMhkyRgxDG5`. Candidate DB catalog fingerprint `ef738d5f7e1fdbe6b42970a9ad13f062` is structural only and is not proof that this DB is the deployed runtime target. Current G04 and G05 fail; certification is blocked. See `RELEASE_STATUS.md` and `release-evidence.json`.
