# Content SEO Launch Kit

This document defines the July 2026 manual Content SEO Launch Kit only.

It does not auto-publish blog posts, call external blog APIs, add OAuth clients, add API keys, add env vars, publish social posts, generate articles from real customer data, publish real customer cases, send messages, charge payments, or write customer data.

## Shared Message

- Problem: stores without memory lose sales because regular-customer preferences, revisit timing, menu choices, and inquiry history are scattered.
- Solution: MyBiz starts with a customer memory card, VIP candidate view, and campaign prep preview.
- Proof: the owner can see what to propose without actual delivery, raw contact access, payment automation, or production data writes.
- Offer: Growth 99,000 KRW.
- Safety: no actual delivery, no raw contact, no payment automation.
- CTA: pilot consultation request.

## Publishing Boundary

- Current publish status: `draft_manual_only`.
- Manual owner review is required before any publishing.
- `docs/manual-publish-checklist.md` must be completed before changing a piece to `approved_for_manual_publish`.
- Publishing URLs are recorded only after manual publishing.
- This kit is a planning artifact. It is not a blog publisher and it does not connect to external blog APIs.

## Content Candidates

### 1. `why_small_stores_need_customer_memory`

- SEO title: Why Small Stores Need to Remember Regular Customers
- meta description: Why small stores lose repeat revenue when regular-customer preferences live only in memory, and how MyBiz starts with safe read-only customer memory.
- target keyword: small store customer memory
- secondary keywords: regular customer management, store CRM, revisit marketing
- search intent: problem awareness for store owners who manage regular customers manually
- outline:
  1. regular-customer memory problem
  2. missed revisit and average-order-value cost
  3. MyBiz customer memory card and VIP candidate preview
  4. manual pilot consultation CTA
- intro angle: show store owners how scattered regular-customer memory turns into missed revisit timing and weaker average order value.
- CTA: pilot consultation request
- internal link target: `/pricing`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_customer_memory`
- publish status: `draft_manual_only`

### 2. `customer_memory_card_revisit`

- SEO title: How a Customer Memory Card Raises Revisit Intent
- meta description: How a customer memory card helps store owners prepare revisit suggestions while keeping campaign delivery and raw contacts blocked.
- target keyword: customer memory card revisit
- secondary keywords: customer memory card, revisit preparation, VIP customer candidate
- search intent: solution comparison for customer revisit preparation
- outline:
  1. customer context owners need before a revisit
  2. masked memory card fields
  3. VIP candidate and campaign prep preview flow
  4. approval-first delivery boundary
- intro angle: explain the customer memory card as a read-only way to prepare the next visit without sending messages or editing customer records.
- CTA: pilot consultation request
- internal link target: `/dashboard/customers`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_memory_card`
- publish status: `draft_manual_only`

### 3. `order_apps_crm_customer_data_gap`

- SEO title: Order Apps and CRM Still Miss Regular-Customer Memory
- meta description: Order apps and CRM lists often miss the practical regular-customer memory store owners need for repeat visits and higher order value.
- target keyword: order app CRM customer data gap
- secondary keywords: order app CRM gap, store customer data, regular customer data
- search intent: comparison for owners evaluating CRM and order-app limitations
- outline:
  1. where order apps stop
  2. where generic CRM lists stop
  3. memory-based revenue engine angle
  4. manual-only pilot next step
- intro angle: position MyBiz against the gap between order-app data, CRM lists, and actionable memory that owners can use before outreach.
- CTA: pilot consultation request
- internal link target: `/pricing`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_crm_gap`
- publish status: `draft_manual_only`

### 4. `cafe_restaurant_regular_customer_automation`

- SEO title: Cafe and Restaurant Regular-Customer Automation Starts with Memory
- meta description: A safe cafe and restaurant regular-customer automation plan starts with read-only customer memory and manual approval, not auto-send.
- target keyword: regular customer automation cafe restaurant
- secondary keywords: cafe customer management, restaurant CRM, regular customer automation
- search intent: category solution search for restaurant and cafe customer management
- outline:
  1. regular-customer patterns in cafes and restaurants
  2. VIP candidate sections
  3. campaign prep preview only
  4. separate approval before delivery
- intro angle: frame cafe and restaurant automation as preview-first: owners review candidates and message drafts before any future approved delivery.
- CTA: pilot consultation request
- internal link target: `/dashboard/customers`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_cafe_restaurant`
- publish status: `draft_manual_only`

### 5. `small_business_ai_support_customer_memory_engine`

- SEO title: Small-Business AI Support Needs a Customer Memory Engine
- meta description: Small-business AI support should lead to measurable customer memory workflows, not unsupported revenue guarantees or funding claims.
- target keyword: small business AI customer memory
- secondary keywords: small business AI, AI store SaaS, customer memory engine
- search intent: education for owners exploring AI support and practical SaaS use cases
- outline:
  1. AI support interest from small businesses
  2. customer memory as practical AI use case
  3. Growth plan pilot offer
  4. approval and privacy boundaries
- intro angle: connect small-business AI support interest to a concrete memory-based revenue engine without promising public funding approval.
- CTA: pilot consultation request
- internal link target: `/pricing`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_ai_support`
- publish status: `draft_manual_only`

### 6. `mybiz_july_pilot_recruiting`

- SEO title: MyBiz July Pilot Recruiting Guide
- meta description: MyBiz July pilot recruiting guide for store owners who want a safe memory-based revenue engine before delivery or payment automation.
- target keyword: MyBiz July pilot
- secondary keywords: MyBiz pilot, store SaaS pilot, Growth 99000
- search intent: conversion search for owners considering the MyBiz July pilot
- outline:
  1. who the July pilot is for
  2. what opens in read-only mode
  3. Growth 99,000 KRW offer
  4. manual consultation request next step
- intro angle: invite 3 to 5 pilot stores into a read-only July flow centered on customer memory, VIP candidates, and campaign preparation previews.
- CTA: pilot consultation request
- internal link target: `/pricing`
- UTM placeholder: `utm_source=manual_blog&utm_medium=seo&utm_campaign=july_pilot_recruiting`
- publish status: `draft_manual_only`

## Forbidden Claims

Do not publish or imply any of these claims:

- revenue guarantee
- auto-send is available
- unauthorized real customer case
- personal-data-based content generation
- government support approval/selection guarantee
- payment automation availability

## Code Contract

The pure code contract is `buildContentSeoLaunchKitPlan()`.

Required values:

- `contentKitPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `contentCount: 6`
- `autoPublishingEnabled: false`
- `externalBlogApiEnabled: false`
- `oauthEnabled: false`
- `apiKeyRequiredNow: false`
- `envRequiredNow: false`
- `customerDataBasedContentEnabled: false`
- `realCustomerCasePublishingEnabled: false`
- `socialPublishingEnabled: false`
- `manualReviewRequired: true`
- `requiresOwnerApprovalBeforePublishing: true`
- `requiresSeoMetadata: true`
- `requiresCanonicalUrl: true`
- `requiresUtmPlaceholder: true`
- `requiresInternalLinks: true`
- `requiresCta: true`

This contract is pure and in-memory. It must not call external blog APIs, add keys, add env vars, open OAuth, publish posts, publish social posts, generate from real customer data, send messages, charge payments, or write customer data.

## Related Documents

- `docs/manual-publish-checklist.md`
- `docs/content-seo-launch-plan.md`
- `docs/blog-readiness-verification.md`
- `docs/july-launch-checklist.md`
