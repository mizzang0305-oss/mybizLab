# Owner-reviewed lead capture console MVP

Date: 2026-06-09

This document defines the first MyBiz owner-reviewed lead capture console. It is a pilot-operations surface, not a live CRM write path.

## Goal

The console helps the owner review FREE diagnosis, pricing, referral, or manual pilot leads before any live store setup, customer notification, payment request, or production DB write happens.

MyBiz is a customer-memory revenue engine. Lead capture should organize merchant pain, operating context, next action, and customer-memory seed readiness so the owner can decide whether a merchant should stay FREE, enter a pilot, or become a PRO/VIP candidate.

## Route

- UI route: `/admin/leads`
- Access boundary: platform admin route group
- Current data source: sanitized mock lead list
- Live persistence: disabled

## Statuses

| Status | Meaning | Allowed now |
| --- | --- | --- |
| `new` | newly captured lead | visible |
| `needs_review` | owner review needed | visible |
| `contacted` | owner reached out | mock-only |
| `pilot_candidate` | good 3-5 store pilot fit | mock-only |
| `setup_in_progress` | owner-assisted setup is being prepared | mock-only |
| `converted` | future paid/customer-memory conversion marker | mock-only |
| `rejected` | not a fit or blocked | mock-only |
| `archived` | no active follow-up | mock-only |

## Data shown in the MVP

The screen may show only masked or sanitized lead fields:

- store name
- business type
- address summary
- contact display name
- masked phone
- masked email
- current customer management method
- reservation/inquiry flow
- main concern
- desired outcome
- data readiness
- pilot fit score
- next action
- owner note
- source
- consent flags summary
- customer memory seed summary

Do not show or log raw customer PII, browser storage, secrets, session values, cookies, payment payloads, or production DB credentials.

## CTA behavior

| CTA | Current behavior | Reason |
| --- | --- | --- |
| 상담 일정 잡기 | copy-only / disabled in MVP | no customer notification approval |
| 파일럿 후보로 표시 | mock state transition | owner review flow only |
| 세팅 시작 | mock state transition | no live store provisioning side effect |
| 고객에게 메시지 발송 | disabled | `customerNotificationEnabled` is OFF |
| 결제 요청 | disabled | `billingCheckoutEnabled` is OFF |
| DB 저장/실반영 | disabled / approval required | `broadDbWriteEnabled` is OFF |

## Repository boundary

Files introduced for the boundary:

- `src/server/mybiz/repositories/leadCaptureRepository.ts`
- `src/server/mybiz/repositories/mockLeadCaptureRepository.ts`
- `src/server/mybiz/repositories/disabledSupabaseLeadCaptureRepository.ts`
- `src/server/mybiz/repositories/supabaseLeadCaptureRepository.ts`

The mock repository supports read and status transition behavior for tests and demos. The disabled Supabase repository returns:

```json
{
  "ok": false,
  "code": "LIVE_LEAD_WRITE_DISABLED",
  "approvalRequired": true
}
```

It must not call `.insert(`, `.upsert(`, `.update(`, or `.delete(`.

The live Supabase repository is approval-prep only. It maps sanitized lead drafts to the draft `lead_capture_requests` table, but the code must check `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, and `liveLeadWriteEnabled` before any `.insert(` call. With the current defaults, live writes return `LIVE_LEAD_WRITE_DISABLED`.

## Launch gates

- `ownerReviewedLeadCaptureEnabled` ON means the owner review flow can render.
- It does not mean live DB writes are allowed.
- `broadDbWriteEnabled` OFF blocks live lead writes.
- `leadCapturePersistenceEnabled` OFF blocks the lead-specific persistence path.
- `liveLeadWriteEnabled` OFF blocks the final live write execution.
- `customerNotificationEnabled` OFF keeps customer messaging disabled.
- `billingCheckoutEnabled` OFF keeps payment requests disabled.

## Customer memory seed

The console should prepare sanitized seed context for later customer-memory work:

- merchant category
- operating pain
- desired revenue outcome
- current customer/contact process
- pilot fit
- owner next action

This is readiness data only until a future approved PR wires live customer memory persistence with RLS evidence.

## Production remaining

Before live use:

1. Approve live lead capture schema and retention policy.
2. Apply migration only after separate approval.
3. Apply RLS policy only after separate approval.
4. Implement live repository writes only after approval.
5. Review consent copy and masked display rules.
6. Keep payment, notification, upload/delete, OAuth/SNS, external AI/STT, and broad DB writes approval-gated.
