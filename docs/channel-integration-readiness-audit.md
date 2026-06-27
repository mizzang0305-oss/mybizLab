# Channel Integration Readiness Audit

This document defines the July 2026 channel integration readiness audit only.

It does not add API keys, add OAuth clients, install provider SDKs, call YouTube/Instagram/Threads APIs, publish social posts, publish blog posts, upload videos, send messages, write production data, or read real customer data.

## Scope

The July pilot should use manual publishing or link-only workflows for external channels. Automated publishing remains future scope after separate owner approval, credential design, channel review, and privacy checks.

## YouTube

- Purpose: MyBiz demo, case-study, and education video distribution
- Current status: `not_implemented`
- Possible future integration: YouTube upload/publishing flow
- Required before integration: Google Cloud project, OAuth consent, channel authorization, quota check, upload policy, content approval
- Forbidden now: API key/env addition, OAuth connection, actual upload, YouTube API call
- July pilot recommendation: manual upload or link-only

## Instagram

- Purpose: Reels, images, and case cards for pilot storytelling
- Current status: `not_implemented`
- Possible future integration: Instagram content publishing flow
- Required before integration: Meta App, Business/Creator account, permission review, token handling, media container, publishing approval
- Forbidden now: API key/env addition, OAuth connection, actual post, Instagram API call
- July pilot recommendation: manual post or content checklist only

## Threads

- Purpose: short insights, pilot logs, and founder story distribution
- Current status: `not_implemented`
- Possible future integration: Threads publishing flow
- Required before integration: Meta App, Threads use case, user authorization, post approval flow
- Forbidden now: API key/env addition, OAuth connection, actual post, Threads API call
- July pilot recommendation: manual post or content checklist only

## Blog

- Purpose: SEO acquisition, case articles, government-support keywords, and small-business AI education
- Current status: `needs_verification`
- Verification plan: `docs/blog-readiness-verification.md`
- Content SEO plan: `docs/content-seo-launch-plan.md`
- Possible future integration:
  - MyBiz native blog
  - Biz2Lab blog connection
  - markdown-based publishing
  - RSS/sitemap-based distribution
- Required before integration:
  - canonical URL
  - author/review flow
  - SEO title/meta
  - UTM tracking
  - internal links
- Forbidden now:
  - automatic publishing
  - external blog API key/env addition
  - publish_blog_post execution
- July pilot recommendation: manual publish or markdown pipeline only

## Readiness Matrix

| Channel | Status | July recommendation | Required owner gate before automation |
| --- | --- | --- | --- |
| YouTube | `not_implemented` | manual upload or link-only | channel authorization, upload policy, and content approval |
| Instagram | `not_implemented` | manual post or content checklist only | Meta permission review, token handling, and post approval |
| Threads | `not_implemented` | manual post or content checklist only | Meta/Threads use case approval and post approval |
| Blog | `needs_verification` | manual publish or markdown pipeline only | canonical URL, SEO review, UTM policy, and author approval |

## Gap List

- no YouTube OAuth or upload flow
- no Instagram media container or publishing flow
- no Threads publishing flow
- no verified blog publishing surface
- no cross-channel analytics attribution
- no UTM naming standard for pilot channels
- no owner approval record for channel content
- no automated publishing rollback plan
- post-pilot channel integrations require the separate approval phrases in `docs/post-pilot-integration-approval-matrix.md`

## Code Contract

The pure code contract is `buildE2eFeatureDataFlowAndChannelAuditPlan()`.

Required channel statuses:

- YouTube: `not_implemented`, `manual_upload_or_link_only`
- Instagram: `not_implemented`, `manual_post_or_content_checklist_only`
- Threads: `not_implemented`, `manual_post_or_content_checklist_only`
- Blog: `needs_verification`, `manual_publish_or_markdown_pipeline_only`

Blocked actions:

- `call_youtube_api`
- `call_instagram_api`
- `call_threads_api`
- `publish_blog_post`
- `add_oauth_client`
- `add_api_key`
- `add_env`
- `upload_video`
- `publish_social_post`
- `write_customer_data`
- `create_store`
- `create_lead`
- `charge_payment`
- `send_sms`
- `send_kakao`
- `send_email`
- `resolve_raw_recipient`

## Related Documents

- `docs/post-pilot-integration-approval-matrix.md`
- `docs/blog-readiness-verification.md`
- `docs/content-seo-launch-plan.md`
- `docs/e2e-feature-data-flow-audit.md`
- `docs/july-launch-checklist.md`
- `docs/vip-customer-delivery-secret-env-architecture.md`
- `docs/vip-customer-delivery-provider-selection.md`
