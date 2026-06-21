# VIP Customer Read-Only Report Sample

## Purpose

This sample defines owner-facing report sections for VIP customer planning. It uses masked customer summaries and aggregate reasons only.

## Section 1: 이번 주 다시 부를 고객 후보

Use this section for VIP customer candidates with recent visit, order, reservation, inquiry, waiting, or timeline activity. The owner goal is to decide whether the customer should receive attention this week.

Sample row shape:

- masked customer: `A********`
- evidence: recent activity plus visit/order summary
- owner note: 확인 전용 리포트

## Section 2: 객단가 상승 가능 고객 후보

Use this section for VIP customer candidates with strong total value or high average order value. The owner goal is to review premium product, bundle, or service opportunities.

Sample row shape:

- masked customer: `B********`
- evidence: aggregate order amount and preference summary
- owner note: no outreach until separate approval

## Section 3: 휴면 위험 VIP 고객 후보

Use this section for customers with strong VIP history and lower recent activity. The owner goal is to identify customers who may need a revisit plan.

Sample row shape:

- masked customer: `C********`
- evidence: older last activity plus historical VIP reasons
- owner note: campaign preparation preview only

## Read-Only Safety Rules

- No customer grade edit control.
- No campaign launch control.
- No message, Kakao, SMS, or email delivery control.
- No production write path.
- No migration or seed dependency.
- No payment, webhook, notification, or external API dependency.

## Future Approval Gate

Messaging integrations can start only after a separate owner approval gate. Until then the product surface should show drafts, target previews, and masked evidence only.
