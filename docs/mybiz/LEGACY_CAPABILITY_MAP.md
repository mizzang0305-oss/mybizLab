# Legacy Capability Map

## Classification inventory

| Classification | Paths / occurrences | Disposition |
| --- | --- | --- |
| CURRENT_CORE | `src/domain/mybiz/**`, `src/pages/service-os/**`, `src/pages/mybiz-field/**`, Stage 2 product spec | canonical Service OS 유지 |
| CURRENT_OPTIONAL_MODULE | contracts, schedules/reservations, brand, content, AI reports, billing subscription surfaces | 필요 업체에 선택 적용 |
| LEGACY_RESTAURANT_VERTICAL | `src/modules/orders/**`, `menu*`, `table-order/**`, `kitchen/**`, `waiting/**`, restaurant reservation flows and their tests | 삭제하지 않고 기본 nav/onboarding에서 분리 |
| CUSTOMER_MEMORY_CAPABILITY | `src/modules/customers/**`, customer-memory services/tests/docs | cross-cutting capability로 보존 |
| HISTORICAL_DOC_ONLY | 과거 pilot, customer-memory rollout, restaurant demo 문서 | 실행 기준이 아닌 이력으로 보존 |
| INTERNAL_COMPATIBILITY | `store_id`, `storeId`, `stores`, legacy `FeatureKey`, query keys, mock providers | 파괴적 rename 금지 |
| PRODUCT_DRIFT_MUST_FIX | README/package description, default onboarding, default dashboard navigation | R3에서 정렬 |
| OWNER_DECISION_REQUIRED | 공개 pricing fallback과 billing canonical amount 차이, restaurant vertical activation policy, provider 선택 | 현 단계에서 값·provider 변경 금지 |

## Preserved restaurant assets

`menu`, `menu_categories`, `menu_items`, `orders`, `order_items`, `table-order`, `kitchen`, `kitchen_tickets`, `waiting`, restaurant reservation, POS compatibility는 삭제하지 않는다. 기본 `adminNavigation`에는 포함하지 않고 `legacyRestaurantNavigation` 및 `/onboarding/legacy-store` 호환 경로로 분리한다.

## Occurrence interpretation

같은 단어라도 무차별 교체하지 않는다. 예를 들어 `order`가 음식 주문 엔티티·테스트에 나타나면 legacy vertical, 결제 provider의 `orderName`이면 SaaS billing compatibility, canonical flow의 순서를 뜻하면 일반 문맥이다. `store_id`는 모든 계층에서 tenant scope 호환 키로 유지한다.
