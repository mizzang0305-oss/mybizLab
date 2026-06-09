# MyBiz production side effects audit

Date: 2026-06-09

This audit classifies side effects that can happen in production code paths. It does not include secret values, token values, cookies, sessions, raw customer data, browser storage values, or payment payloads.

## Classification

- `read_only`: reads data or renders UI only.
- `local_only`: local/mock state or browser state only.
- `mock_only`: demo/mock repository behavior.
- `external_api`: can call an external provider.
- `db_write`: can insert, update, upsert, or delete live data.
- `payment`: can open checkout, verify payment, or process payment events.
- `notification`: can send or prepare customer-facing messages.
- `upload`: can upload or remove files.
- `auth`: can sign in/out or validate user/session.
- `env_required`: depends on environment configuration.
- `approval_required`: must not be used in production until explicitly approved.

## Side effect surfaces

| Surface | Code area | Classification | Trigger | Launch decision |
| --- | --- | --- | --- | --- |
| Landing and marketing routes | `src/pages/*`, public router group | `read_only` | page view | Launch ON |
| Pricing FREE CTA | `src/pages/PricingPage.tsx` | `read_only` for FREE link | click FREE CTA | Launch ON |
| Pricing paid checkout | `src/pages/PricingPage.tsx`, `src/shared/lib/portoneCheckout.ts`, `src/server/billingCheckout.ts` | `payment`, `external_api`, `env_required`, `approval_required` | click PRO/VIP payment CTA | Hidden or approval-gated |
| Public payment test product | pricing/platform admin content | `payment`, `approval_required` | test payment route/content enabled | Admin/test only, never normal public pricing |
| Billing webhook | `src/server/billingWebhook.ts` | `payment`, `db_write`, `env_required`, `approval_required` | provider webhook | Keep approval-gated |
| Onboarding setup request | `src/shared/lib/services/mvpService.ts`, `/api/onboarding/setup-request` | `db_write`, `approval_required` | submit onboarding request in live runtime | Allowed only as reviewed lead capture |
| Store provisioning RPC | `src/shared/lib/services/mvpService.ts`, `/api/stores/provision` | `db_write`, `auth`, `env_required`, `approval_required` | owner/admin creates store | Owner-assisted only |
| Public store page read | public store API and store public routes | `read_only`, `needs_db` | page view | Pilot only until visibility/RLS verified |
| Public inquiry submit | public inquiry route/service | `db_write`, `needs_subscription_gate`, `approval_required` | customer submits inquiry | PRO/VIP or approved limited FREE only |
| Public consultation submit | consultation route/service | `db_write`, `approval_required` | customer submits consultation | Pilot only |
| Public reservation submit | reservation route/service | `db_write`, `needs_subscription_gate`, `approval_required` | customer submits reservation | PRO/VIP pilot only |
| Public waiting submit | waiting route/service | `db_write`, `needs_subscription_gate`, `approval_required` | customer joins waiting list | PRO/VIP pilot only |
| Public order submit | store order route/service | `db_write`, `payment`, `approval_required` | customer submits table/order flow | Hidden until order/payment policy approved |
| Order payment checkout/verify | public API payment routes | `payment`, `db_write`, `external_api`, `approval_required` | order payment action | Hidden until approved |
| Merchant dashboard writes | dashboard modules and services | `db_write`, `auth`, `needs_db` | merchant/admin save actions | Pilot/internal only |
| Platform admin console | `/admin/*`, platform admin APIs | `db_write`, `auth`, `env_required` | platform admin actions | Platform owner only |
| Owner-reviewed lead console | `/admin/leads`, lead capture mock/disabled/live-gated repository | `mock_only`, `approval_required` for live write | platform owner reviews pilot leads | UI ON, live write disabled |
| Lead capture persistence draft | `lead_capture_requests`, Supabase lead repository | `db_write`, `approval_required` | future owner-reviewed lead persistence | Draft only; migration/RLS/live write approval required |
| Admin login/session | admin auth/session services | `auth`, `local_only`, `env_required` | login/logout/session validation | Must stay auth-gated |
| Customer CRM and timeline | customer/timeline services | `db_write`, `needs_db`, `approval_required` | customer updates/actions | Pilot only, masked display |
| Customer timeline action buttons | customer timeline intelligence | `notification`, `approval_required` if enabled | currently disabled actions | Keep disabled |
| Gallery upload | `src/shared/lib/services/storeGalleryService.ts` | `upload`, `db_write`, `delete`, `approval_required` | upload/update/delete media | Disable unless storage/RLS approved |
| Content/social OAuth | external social and OAuth services | `external_api`, `auth`, `db_write`, `env_required`, `approval_required` | connect/publish provider | Internal only |
| YouTube upload | YouTube provider/service | `external_api`, `upload`, `env_required`, `approval_required` | upload readiness and job execution | Keep disabled unless approved |
| STT provider | STT provider service | `external_api`, `env_required`, `approval_required` | transcript generation | Disabled/mock unless approved |
| Gemini summary | Gemini integration and AI report paths | `external_api`, `env_required`, `approval_required` | generate summary | Disabled or budget-gated |
| OpenAI diagnosis | server AI diagnosis path | `external_api`, `env_required`, `approval_required` | diagnosis generation | Disabled or budget-gated |
| Local/session storage | public layout, onboarding/admin session | `local_only` | page/session behavior | Allowed, but never log raw values |
| Vercel deploy | GitHub merge/main pipeline | `deploy`, `approval_required` | merge to main or manual deploy | No deploy without approval |

## Production side effect summary

Potential automatic side effects on page view are low for landing and marketing pages. Most dangerous side effects are user-click or submit triggered:

- paid checkout
- onboarding setup request submit
- public inquiry/consultation/reservation/waiting/order submit
- dashboard/admin save actions
- upload/delete actions
- OAuth/social provider actions
- AI/STT provider calls

## Launch gate implementation status

`src/shared/lib/launchGates.ts` centralizes the pilot beta defaults. The current code-level enforcement added in this branch is intentionally narrow:

- Public pricing shows FREE/PRO/VIP and keeps FREE onboarding live.
- PRO/VIP paid checkout buttons are disabled by default and tell merchants that payment is applied after pilot consultation.
- Public payment test UI is hidden unless `billingCheckoutEnabled` is explicitly enabled in code.
- `/api/billing/checkout` returns a sanitized `LAUNCH_GATE_DISABLED` response before checkout env loading or provider session preparation.
- `/admin/leads` renders the owner-reviewed lead workflow with masked mock data. Message, payment, and live DB actions remain disabled; the disabled lead repository returns `LIVE_LEAD_WRITE_DISABLED`.
- The draft live lead repository requires `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, and `liveLeadWriteEnabled` before any Supabase insert can run.

No webhook, auth/session, env, DB/RLS, customer notification, upload/delete, OAuth/SNS publishing, external AI/STT, merge, deploy, or rollback behavior was changed.

## Must remain blocked before broad launch

1. Payment provider calls unless payment approval is explicit.
2. Billing webhook mutations unless webhook approval and rollback plan are explicit.
3. Customer notifications unless consent and owner approval exist.
4. External API mutations unless provider readiness and cost controls exist.
5. Production DB writes unless RLS and store membership boundaries are verified.
6. Upload/delete flows unless storage policy and moderation are approved.
7. Any deploy unless merge/deploy approval is explicit.

## Sanitized `side_effects` record

```json
{
  "github_pr_ready": true,
  "merge": false,
  "merge_commit": null,
  "manual_production_deploy": false,
  "auto_vercel_deploy_detected": false,
  "production_read_only_smoke": false,
  "db_write": false,
  "migration_apply": false,
  "rls_policy_apply": false,
  "live_lead_write": false,
  "payment_provider_call": false,
  "payment_behavior_change": true,
  "webhook_change": false,
  "auth_or_env_change": false,
  "customer_notification": false,
  "external_api_mutation": false,
  "launch_gate_added": true,
  "code_safety_patch": true,
  "docs_created_or_updated": true,
  "obsidian_updated": true,
  "stashes_preserved": true,
  "untracked_preserved": [".claude/worktrees/", "AGENTS.md"]
}
```
