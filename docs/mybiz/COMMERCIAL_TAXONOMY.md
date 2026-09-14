# Commercial Taxonomy

## Independent dimensions

| Dimension | Values | Buyer / purpose |
| --- | --- | --- |
| `subscription_plan` | FREE, PRO, VIP | Merchant가 MyBizLab에 지급하는 SaaS 구독 |
| `brand_site_tier` | Basic, Brand, Growth | 업체 브랜드 홈페이지 구성 범위 |

`subscription_plan != brand_site_tier`

Brand/Growth라는 홈페이지 패키지 라벨은 PRO/VIP 구독 entitlement와 자동으로 대응하지 않는다. 조합 가능 여부와 가격은 별도 상업 정책으로 결정한다.

## Current code audit

- `src/shared/lib/billingPlans.ts`: billing checkout용 FREE/PRO/VIP 기준
- `src/shared/lib/siteConfig.ts`: 공개 pricing fallback copy
- `src/pages/mybiz-field/WebsitePackageShowcase.tsx`: Basic/Brand/Growth 홈페이지 패키지
- platform billing config: 운영자가 관리하는 구독 product/plan 데이터

공개 pricing fallback과 billing canonical amount 사이에는 기존 값 차이가 있다. R3는 Owner 승인 없이 실제 가격, checkout product, entitlement를 변경하지 않으며 이를 `OWNER_DECISION_REQUIRED`로 남긴다.

## Payment boundary

- SaaS payment: Merchant → MyBiz subscription → MyBizLab
- Service payment: End Customer → Merchant
- `CUSTOMER_CONFIRMED != PAYMENT_PAID`
