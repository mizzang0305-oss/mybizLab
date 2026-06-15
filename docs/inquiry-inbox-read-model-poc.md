# Inquiry Inbox Read Model PoC

## Intent

This PoC adds a small read-only inquiry inbox on top of the existing MyBiz customer memory spine.
It is inspired by the Chatwoot-style concept of an inbox, conversation list, and customer context, but it does not copy Chatwoot source code, UI copy, database schema, or assets.

## Chatwoot-style concept only

- Use an inquiry list as the owner-facing entry point.
- Show one row per inquiry with customer context, contact channel, status, and latest timeline signal.
- Keep the list fast to scan before adding write workflows such as status update, assignment, or follow-up tasks.
- No Chatwoot source code or UI copy is copied.

## MyBiz Customer Spine Connection

The read model is built from existing MyBiz spine data:

- `inquiries`
- `customers`
- `customer_contacts`
- `customer_timeline_events`

The API stays behind the existing `api/admin.ts` dispatcher. No new Vercel serverless function file is added.

## Read Model Fields

Each inbox row returns only sanitized owner-facing fields:

- inquiry id
- store id
- inquiry status
- inquiry category and subject
- masked inquiry summary
- created time
- linked customer id when present
- masked customer display name
- masked contact channel
- latest timeline event type and sanitized summary
- follow-up needed flag

## Privacy and Masking Policy

- Raw phone numbers are replaced with masked phone output.
- Raw emails are replaced with masked email output or `[email]` in text summaries.
- Raw customer names are replaced with masked display names and `[customer]` in summaries.
- Inquiry message previews and timeline summaries redact phone/email patterns before returning data.
- Timeline metadata is not exposed by this read model.
- Raw PII logging is not introduced.

## Write Boundary

This PR is read-only.

- production DB write is forbidden.
- inquiry status update is out of scope.
- customer timeline event creation is out of scope.
- migration files are out of scope.
- Supabase db push, migration repair, migration apply, RLS changes, and GRANT/REVOKE are out of scope.
- live customer memory write and live lead write remain disabled.
- external AI calls and customer notifications are out of scope.
- Sales Excel import is out of scope.

## Revenue Path

This supports:

- PRO customer management: owners can scan unresolved inquiry/customer context quickly.
- VIP follow-up management: linked customer/timeline context makes high-value follow-up easier.
- Customer memory adoption: owners can see why public inquiries should become customer memory records before write launch.

## Next Steps

The next approval-gated PRs can add:

- inquiry status update from the inbox
- owner follow-up task creation
- AI summary after prompt/PII redaction policy is approved
- deeper timeline detail drawer
- schema/RLS alignment and live write readiness after the existing blockers are resolved

## Rollback

Rollback is a normal PR revert because this PoC does not add migration files or production write behavior.
If a future PR adds schema or live writes, that PR must include a separate rollback plan and explicit approval checklist.
