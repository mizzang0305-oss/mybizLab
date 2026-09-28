# MyBiz provisioning HOLD history

- Classification: `HISTORICAL_PRODUCTION_STATE_EVIDENCE`
- Version: `20260928000000`
- Source path: `supabase/migrations/20260928000000_mybiz_provisioning_hold.sql`
- Archived file: `20260928000000_mybiz_provisioning_hold.sql`
- SQL SHA-256: `ab4dd45e35f61bd809d39f43664092b5b8597f3767f1e84546a5291f867db5b5`
- Production catalog: the provisioning RPC EXECUTE HOLD is already effective.
- Production migration ledger: this version is **absent**.

This file preserves the Owner-applied state for review. It is outside the
active `supabase/migrations/` scan. Do not replay it in Production or treat it
as a `db push` target. A ledger-only reconciliation is **not required** to merge
PR #190. Any future ledger reconciliation requires separate Owner approval.

`CURRENT_PRODUCTION_SCHEMA_BASELINE_V1` is the current canonical application
schema starting point. This archived SQL is not a historical full-replay claim.

## Already-applied SQL removed from the active scan

The following files are byte-identical to their previous Git blobs. Each
version is present in the shared Production migration ledger, and its schema
effects are already represented by the V4 current-state baseline. None can
bootstrap an empty application database after the comment-only `20260614`
marker. Classification: `HISTORICAL_UNREPLAYABLE`.

| Version | Archived file | Git SQL SHA-256 | Missing prerequisite on an empty database |
| --- | --- | --- | --- |
| `20260615075421` | `20260615075421_customer_memory_schema_alignment.sql` | `84f0028357ba5d521cb82b691ee37aac1c00e2b52eb5eeb413aed9defe789a28` | `public.customers`, `public.customer_contacts`, `public.inquiries` |
| `20260616070824` | `20260616070824_customer_memory_rls_grant_hardening.sql` | `5f56ba21706387e9beb57565f6970879530ad09207087c54683e1b39e47d33d4` | Customer-memory tables and `public.is_store_member(uuid)` |
| `20260927064807` | `20260927064807_mybiz_server_provisioning_boundary_20260927.sql` | `81cbfb386f9d09858f3acac7e4b2f9849e41eb6712663035a0c81aa57af56c05` | `core.profiles`, `private.profile_auth_bindings`, store tables |
| `20260927064932` | `20260927064932_mybiz_public_rls_compat_20260927.sql` | `4011dad239954ec7f4e3f6c717500d54952cd6247762e53625cfefc0bb4638d3` | 15 target tables and membership helper |

These are historical evidence, not pending migrations. Do not apply them to
Production or replay them after V4. The shared ledger rows remain unchanged;
no migration repair is required to move these Git files. The active scan
contains the no-op `20260614` baseline marker (`BASELINE_MARKER`) and the
CLI-created `20260928232001_service_os_verified_identity_resolver.sql`
(`REPLAYABLE_FUTURE_MIGRATION`). The marker's ledger row is present, but the
marker alone does not produce the application schema. Local/CI bootstrap must
apply V4 before the future migration. Neither SQL has been applied to
Production by this review task.
