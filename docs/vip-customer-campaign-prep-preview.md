# VIP Customer Campaign Preparation Preview

## Purpose

The VIP campaign preparation preview helps a store owner review campaign ideas for VIP customer candidates before any delivery or customer-write workflow exists.

It is a read-only and preview-only planning surface.

## Scope

The preview can show:

- campaign purpose
- candidate count
- masked customer candidates
- recommended reason per customer
- suggested message draft
- caution text
- delivery approval gate notice
- read-only / preview-only badges

The preview must not execute campaigns, send SMS, send Kakao messages, send email, update customers, edit customer notes, create customers, delete customers, merge customers, or write production data.

## Campaign Sections

1. 이번 주 다시 부를 고객
2. 객단가 상승 가능 고객
3. 휴면 위험 VIP 고객

These sections are prepared from the existing VIP customer read-only report sample. They are planning sections only.

## Delivery Approval Gate

SMS, Kakao, and email integrations require a separate delivery approval gate. Until that gate is approved, MyBiz must keep message text as a draft and target lists as masked previews.

The detailed gate is defined in `docs/vip-customer-delivery-approval-gate.md`. It requires owner approval, marketing consent review, masked preview review, final recipient count review, cost review, store_id tenancy review, failure/cancellation/withdrawal handling, duplicate-send prevention, and future delivery logs before any delivery integration can be designed.

## Privacy And Masking

The preview shows masked names, masked contacts, aggregate reasons, and candidate counts only. It must not render raw customer names, raw phone numbers, raw email addresses, raw rows, secrets, or private notes.

## Store Tenancy

Every candidate must match the active `store_id` before entering the campaign preview. Cross-store customer, order, preference, or timeline data must be excluded before section grouping.

## Future Expansion

Future work can add owner approval workflow, delivery-provider integration, message audit logs, and campaign history only after separate approval. Those future steps need explicit safety gates for production DB writes, notification delivery, customer updates, payment/billing impact, and rollback.
