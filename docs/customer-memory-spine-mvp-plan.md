# MyBiz customer memory spine MVP plan

Date: 2026-06-09

MyBiz is a customer-memory revenue engine. This plan defines the minimum safe path from FREE acquisition to PRO/VIP conversion while keeping production customer data protected.

## MVP memory spine

The customer memory spine is:

1. `customers` as the store-local customer root.
2. `customer_contacts` as normalized customer identity.
3. `customer_preferences` as consent and preference memory.
4. `customer_timeline_events` as the append-only memory ledger.
5. `inquiries`, `reservations`, and `waiting_entries` as demand signals that can attach to customers only after approval-gated customer memory write rules are live.

## Required invariants

- `store_id` is required for every customer memory write.
- `customer_id` is required for every timeline event.
- Customer identity is store-local, not global across merchants.
- Phone dedupe uses normalized digits, scoped by `store_id`.
- Email dedupe uses lowercase trimmed email, scoped by `store_id`.
- Timeline summaries must stay sanitized and should not contain secrets, payment payloads, raw browser storage, or raw private evidence.
- Marketing consent and operational memory are separate fields.
- Broad DB write remains OFF until RLS and owner approval are complete.

## FREE to PRO/VIP path

| Stage | User problem solved | Revenue path | Data collected | Current launch state |
| --- | --- | --- | --- | --- |
| Landing and pricing | Merchant understands the offer | FREE acquisition | Public interest only | ON |
| FREE onboarding diagnosis | Merchant starts without payment | Qualified lead | Business type, pain point, desired outcome, plan intent | ON |
| Owner-reviewed lead capture | Merchant gets safe setup help | Trust and conversion | Sanitized setup request | ON, reviewed |
| Lead capture console | Owner classifies pilot fit and next action | Pilot conversion | Masked contact, pain point, desired outcome, memory seed summary | Mock-only |
| Pilot public page | Merchant can show a real page | PRO/VIP proof | Store profile and public page signals | Pilot only |
| Inquiry/reservation/waiting | Merchant captures demand | PRO/VIP upgrade value | Customer contact and demand signal | Approval-gated |
| Customer timeline intelligence | Merchant sees repeat-sale memory | PRO/VIP lock-in | Timeline and preferences | Approval-gated |
| Paid checkout | Merchant self-serves upgrade | Paid launch | Payment/subscription state | OFF |

## Repository boundary

New boundary files under `src/server/mybiz/repositories/` are intentionally approval-gated:

- mock writes are blocked unless `broadDbWriteEnabled` and `allowCustomerMemoryWrites` are both true.
- Supabase customer memory writes are not implemented in this branch.
- tests assert the Supabase boundary does not contain direct `.from(`, `.insert(`, `.upsert(`, `.update(`, `.delete(`, or `.rpc(` calls.
- lead capture uses a separate mock/disabled repository boundary. The console can change local status only; the disabled Supabase lead adapter returns `LIVE_LEAD_WRITE_DISABLED` and contains no live write calls.
- the draft live lead repository writes only after `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, and `liveLeadWriteEnabled` are all approved. Current defaults keep it blocked before any Supabase insert.
- `lead_capture_requests` is a migration/RLS draft for owner-reviewed lead persistence, not an applied production table.

This makes the next implementation PR explicit: wire real Supabase writes only after migration/RLS evidence and approval are available.

## Pilot readiness

Ready for:

- limited public beta messaging
- FREE onboarding acquisition
- owner-reviewed pilot setup planning
- `/admin/leads` pilot lead review using masked mock data
- mock/demo customer memory demonstration

Not ready for:

- broad live customer PII writes
- automatic customer notifications
- self-serve PRO/VIP payment
- webhook-driven subscription mutation
- upload/delete mutation
- external AI/STT over real customer data

## Next implementation approvals

1. Approve RLS/migration application plan.
2. Approve public form consent and retention copy.
3. Approve live customer memory repository implementation.
4. Approve store membership dashboard access verification.
5. Approve store subscription entitlement hardening.
6. Approve payment approval gate separately from customer memory.
