# Manual Publish Checklist

This checklist controls manual publishing for the July 2026 Content SEO Launch Kit.

It does not auto-publish content, call external blog APIs, add OAuth clients, add API keys, add env vars, publish social posts, send messages, charge payments, read real customer data, or write customer data.

## Required Review

- owner approval before publishing
- SEO title check
- meta description check
- canonical URL check
- UTM placeholder check
- internal link check
- CTA check
- personal information inclusion check
- real customer case inclusion check
- remove revenue guarantee claims
- confirm not auto-published
- record URL after manual publishing

## Publish Statuses

Use only these statuses:

- `draft_manual_only`
- `owner_review_required`
- `approved_for_manual_publish`
- `published_manually`
- `rejected`
- `needs_revision`

## Pre-Publish Gate

Before a content item can move from `draft_manual_only` to `approved_for_manual_publish`:

1. The owner has approved the final article text.
2. The SEO title and meta description match the store-owner search intent.
3. The canonical URL is selected.
4. The internal link target is valid and points to an approved MyBiz surface.
5. The CTA is `pilot consultation request`.
6. The UTM placeholder is present and uses a manual campaign naming convention.
7. The article contains no raw phone numbers, raw email addresses, customer screenshots, raw customer rows, or personal information.
8. The article contains no real customer case unless a separate approval exists.
9. The article does not claim revenue guarantee, auto-send availability, government support approval, payment automation availability, or live delivery.
10. The owner records the final URL after manual publishing.

## Blocked Actions

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

## Related Documents

- `docs/content-seo-launch-kit.md`
- `docs/content-seo-launch-plan.md`
- `docs/blog-readiness-verification.md`
