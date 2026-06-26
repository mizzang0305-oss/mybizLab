# Blog Readiness Verification

This document verifies blog readiness for the July 2026 pilot only.

It does not auto-publish posts, call external blog APIs, add OAuth clients, add API keys, add env vars, publish social posts, generate articles from real customer data, publish real customer cases, send messages, charge payments, or write customer data.

## Purpose

The blog supports three July pilot goals:

- SEO acquisition for store owners searching for customer memory, CRM, revisit, and average order value problems
- trust content that explains MyBiz as a memory-based revenue engine
- pilot consultation induction through clear manual CTAs

## Current Status

- Current status: `needs_verification`
- Recommended mode: `manual_publish_or_markdown_pipeline_only`
- MyBiz native blog: possible future surface
- Biz2Lab blog: possible connected surface after owner approval
- markdown-based publishing: recommended safe starting path
- auto-publishing not open
- external blog API key/env not used

The July pilot should start with manual publishing or a markdown-only pipeline. Automation remains blocked until a separate owner approval, author/review flow, publishing rollback plan, and analytics policy exist.

## Publishing Surface Options

| Option | July status | Notes |
| --- | --- | --- |
| MyBiz native blog | possible, needs verification | Best for first-party SEO and product-led CTA ownership. |
| Biz2Lab blog | possible, needs verification | Useful if current blog authority or content workflow is stronger there. |
| markdown-based publishing | recommended manual path | Keeps review, diff, and rollback visible without external API calls. |
| external blog API publishing | blocked | Requires keys, auth, rate-limit policy, audit, and owner approval. |

## SEO Requirements

Each manual article should define:

- SEO title
- meta description
- canonical URL
- RSS inclusion plan
- sitemap inclusion plan
- internal link to pricing, pilot consultation, and VIP Customer Memory pages
- UTM tracking for pilot consultation request links
- author/review flow before publishing

## July Manual Publishing Topics

Use these topic IDs for planning and tracking. They are safe planning labels and do not imply auto-publication.

| Topic ID | Purpose |
| --- | --- |
| `why_small_stores_need_customer_memory` | Explain why small stores lose sales when customer memory lives only in staff memory. |
| `customer_memory_card_revisit` | Show how a customer memory card helps owners prepare revisit suggestions. |
| `order_apps_crm_customer_data_gap` | Explain the gap between order apps, CRM lists, and actionable customer memory. |
| `cafe_restaurant_regular_customer_automation` | Frame regular-customer follow-up for cafes and restaurants without actual delivery. |
| `small_business_ai_support_customer_memory_engine` | Connect AI support programs to a practical memory-based revenue engine. |
| `mybiz_july_pilot_recruiting` | Invite store owners to a pilot consultation request for the July read-only pilot. |

## Safety Boundary

Blocked actions:

- `auto_publish_blog_post`
- `call_external_blog_api`
- `add_oauth_client`
- `add_api_key`
- `add_env`
- `publish_customer_case_without_approval`
- `generate_article_from_real_customer_data`
- `publish_social_post`
- `send_sms`
- `send_kakao`
- `send_email`
- `charge_payment`
- `write_customer_data`

Articles must not include real phone numbers, real email addresses, raw customer rows, customer screenshots, real customer cases, payment automation claims, delivery automation claims, or revenue guarantee claims.

## Code Contract

The pure code contract is `buildBlogReadinessVerificationPlan()`.

Required values:

- `blogReadinessPlanOnly: true`
- `targetMonth: "2026-07"`
- `positioning: "memory_based_revenue_engine"`
- `launchMode: "pilot_readonly_revenue_engine"`
- `blogStatus: "needs_verification"`
- `recommendedLaunchMode: "manual_publish_or_markdown_pipeline_only"`
- `blogAutoPublishingEnabled: false`
- `externalBlogApiEnabled: false`
- `oauthEnabled: false`
- `apiKeyRequiredNow: false`
- `envRequiredNow: false`
- `customerDataBasedContentEnabled: false`
- `realCustomerCasePublishingEnabled: false`
- `requiresOwnerApprovalBeforePublishing: true`
- `requiresSeoMetadata: true`
- `requiresCanonicalUrl: true`
- `requiresUtmTrackingPlan: true`
- `requiresAuthorReviewFlow: true`

This contract is pure and in-memory. It must not call external blog APIs, add keys, add env vars, open OAuth, publish posts, publish social posts, generate from real customer data, send messages, charge payments, or write customer data.

## Related Documents

- `docs/content-seo-launch-plan.md`
- `docs/channel-integration-readiness-audit.md`
- `docs/e2e-feature-data-flow-audit.md`
- `docs/july-launch-checklist.md`
