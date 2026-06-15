# Daily store summary job interface

This PR adds a Trigger.dev-style structure only for MyBiz internal store automation planning. No Trigger.dev source code is copied, no external queue or worker is connected, and no production job execution is enabled.

## Scope

- Job runs are simulated from existing local/mock MyBiz customer, inquiry, timeline, and AI-trace readiness data.
- The interface is read-only. Manual run, retry, cancel, and approve actions remain disabled.
- No external queue or worker is connected.
- No production job execution is enabled.
- Production DB write, migration, db push, migration repair, RLS, GRANT/REVOKE, live customer memory write, live lead write, and live AI trace write remain forbidden.
- Sales Excel import is out of scope.

## Trigger.dev-style structure only

The borrowed concept is the shape of durable automation operations:

- job run id
- job type
- task status
- retry count
- started and completed timestamps
- safe metrics
- result summary
- optional error code

This is not a Trigger.dev integration and does not contain copied Trigger.dev implementation or UI copy.

## Safe metrics policy

The job payload stores counts only:

- inquiry count
- new customer count
- timeline event count
- pending inquiry count
- follow-up candidate count
- AI trace needs-review count

Raw customer names, phone numbers, email addresses, inquiry text, and timeline content must not be serialized into job results, logs, metrics, UI panels, or documents.

## VIP automation revenue path

The first business use is VIP daily owner reporting. Store owners can later receive a safe daily summary of customer memory, inquiries, and follow-up candidates after queue, worker, privacy, schema, and launch-gate approvals.

## Approval gate before live jobs

Before real queue or worker execution:

1. approve queue/worker provider, retry policy, and retention policy
2. approve schema/RLS/grant design if job runs are persisted
3. prove raw PII cannot enter run logs, metrics, prompts, notifications, or UI
4. explicitly enable the relevant launch gates
5. run production read-only smoke and a separate worker canary only after approval
