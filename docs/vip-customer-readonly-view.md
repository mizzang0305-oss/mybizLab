# VIP Customer Read-Only View

## Purpose

The VIP customer read-only view helps store owners quickly inspect high-value customer candidates from existing customer memory signals. It is a merchant operations view, not a customer tier management workflow.

## Read-Only Scope

- Uses already-loaded customer, order, preference, and timeline read models.
- Does not create, update, delete, merge, or reclassify customers.
- Does not write to production DB.
- Does not add or apply migrations.
- Does not seed production data.
- Does not send notifications, webhooks, billing events, or external API calls.

## VIP Customer Versus VIP Subscription

`store_subscriptions.plan = "vip"` means the store is on the VIP subscription plan. It is not the same concept as a VIP customer.

Customer VIP candidates are derived only from customer-level signals:

- explicit customer VIP-like fields when present
- `segment`, `tier`, or `tags` containing `vip`
- visit count threshold
- order count threshold
- lifetime order value threshold

## Privacy And Masking

The view masks customer identity and contact details before rendering:

- names are shortened to first character plus mask characters
- phone numbers are shown as masked contact strings
- email addresses are shown as masked contact strings
- raw row samples, tokens, secrets, and connection strings are not rendered

## Store Tenancy

The read model filters every source collection by the active `store_id`. Customers, orders, preferences, and timeline events from other stores are excluded before VIP derivation.

## Future Expansion

Future work may add manual VIP tagging, VIP candidate recommendations, VIP revisit campaigns, POS-based LTV scoring, or PRO/VIP entitlement integration. Each expansion needs a separate approval gate because those features can introduce writes, outreach, billing, or entitlement behavior.
