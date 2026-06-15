# AI trace prompt eval interface

This PR adds a Langfuse-style structure only for MyBiz internal AI quality control. No Langfuse source code is copied, no external Langfuse server is connected, and no external AI API is called.

## Scope

- Trace records are generated from existing local/mock MyBiz inquiry, customer, and timeline data.
- The model provider is `mock` and the summarizer is deterministic.
- The interface is read-only. Review and approval actions remain disabled.
- No external Langfuse server is connected.
- No external AI API is called.
- Production DB write, migration, db push, migration repair, RLS, GRANT/REVOKE, live customer memory write, and live lead write remain forbidden.
- Sales Excel import is out of scope.

## Langfuse-style structure only

The borrowed concept is the shape of AI quality operations:

- trace id for a single AI-quality event
- prompt version for reproducibility
- model provider label
- redacted input summary
- generated output summary
- quality score and eval status

This is not a Langfuse integration and does not contain copied Langfuse implementation or UI copy.

## PII redaction policy

Trace payloads must not store raw customer names, phone numbers, or email addresses. Inputs and outputs are reduced to safe summaries:

- emails become `[email]`
- phone-like values become `[phone]`
- known customer names become `[customer]`
- timeline metadata is not serialized into trace payloads

## VIP AI report revenue path

The first business use is VIP AI report quality control. Store owners can later see why an AI report, inquiry summary, or customer summary was produced, while the operator can review prompt versions and eval status before enabling provider-backed AI.

## Approval gate before real AI

Before connecting any real LLM provider or external observability server:

1. approve provider, cost, and retention policy
2. approve schema/RLS/grant design for trace persistence
3. prove raw PII cannot enter prompts, traces, evals, logs, or UI
4. explicitly enable the relevant launch gates
5. run production read-only smoke and a separate write canary only after approval
