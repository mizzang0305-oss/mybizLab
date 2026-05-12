# Reorder / Upsell Recommendation v1

## Purpose

This dashboard layer turns customer memory into merchant-visible action candidates. It helps a store owner decide which customers are good fits for reorder prompts, upsell offers, revisit reminders, review requests, reservation follow-up, waiting follow-up, or review-to-content conversion.

This PR does not send messages, email, KakaoTalk, SMS, or external posts. It does not call an AI provider. Recommendations are deterministic read-model output plus owner-controlled action state.

## Recommendation Types

- `reorder`: repeated or recent item patterns suggest a reorder prompt candidate.
- `upsell`: high average order value, item variety, or bundle potential suggests a premium/set option candidate.
- `revisit`: previous order or visit evidence with a widening order gap suggests a revisit candidate.
- `review_request`: recent transaction activity without a recent review suggests a review request candidate.
- `reservation_followup`: pending reservation state suggests an owner follow-up candidate.
- `waiting_followup`: waiting activity without later order/review evidence suggests a follow-up candidate.
- `content_conversion`: published review with `content_usage_consent=true` suggests a blog/news draft candidate.

## Rule v1

The first version uses deterministic scoring only:

- Reorder score rises with repeated item count and days since last order.
- Upsell score rises when customer AOV exceeds store AOV and when item variety exists.
- Revisit score rises as the last-order gap grows.
- Review request appears when transaction activity exists and recent review activity is missing.
- Content conversion appears only from a published review with content usage consent.

Confidence is `low`, `medium`, or `high` based on signal strength and order item availability. Priority is also derived from score, then lowered when a recommendation is blocked.

## Consent And Quiet Mode

The engine separates consent types:

- `marketing_opt_in=false` blocks marketing-style outreach candidates.
- `quiet_mode` blocks outreach-style candidates.
- Missing contact data blocks contact-based actions.
- `content_usage_consent=false` blocks external content conversion.

Blocked candidates can still be shown as operational context, but `can_execute=false` and the UI records status only. No message delivery is attempted.

## Action State

`customer_recommendation_actions` stores owner state for generated recommendation keys:

- `suggested`
- `dismissed`
- `completed`
- `snoozed`

The table is store scoped, has a unique `(store_id, customer_id, recommendation_key)`, and uses store member RLS. The migration is not auto-run in production.

## Privacy

Recommendation DTOs do not expose raw payloads, `public_token`, access tokens, refresh tokens, provider secrets, raw phone numbers, or raw email addresses. Customer display continues to use the shared fallback policy, so a linked customer is not rendered as unregistered.

## Follow-Up

Later PRs can add persisted action lifecycle UX, owner-approved outreach execution, and AI-generated explanations. Those future layers must keep consent, quiet mode, and merchant approval gates intact.
