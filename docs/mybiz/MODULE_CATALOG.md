# MyBiz Module Catalog

## Core

| Module | Purpose |
| --- | --- |
| customers | 고객/문의와 업무 관계 |
| jobs + job status | 한 건의 업무와 진행 상태 |
| work history | 수행·보완·완료 이력 |
| evidence + media | 작업 결과와 버전별 증빙 |
| customer confirmation | 결과 확인/보완 요청 분리 |
| business history | 업체 단위 운영 기록 |

## Optional modules

| Module | Activation rule |
| --- | --- |
| contract | 계약·동의가 필요한 업종 |
| payment tracking | 대금 요청·상태 추적이 필요한 업체 |
| schedule/reservation | 일정 또는 예약이 필요한 업종 |
| customer memory | 재방문·재상담 이력이 중요한 업체 |
| brand website | 업체 홈페이지가 필요한 경우 |
| media vault | 증빙 원본·파생본 보관이 필요한 경우 |
| Google Drive sync | merchant-owned export/copy가 필요한 경우 |
| content/blog/SNS | 동의된 결과를 검토 후 활용하는 경우 |
| AI reports/automation | 요약·추천·반복 업무 지원이 필요한 경우 |

모든 업종에 모든 모듈을 강제하지 않는다. 구현되지 않은 Service OS 화면을 fake-live route로 만들지 않으며, 현재 기본 내비게이션은 실제 존재하는 업무 현황·고객·일정·계약·증빙·브랜드·콘텐츠·리포트 화면만 사용한다.

## Capability placement

- Customer Memory: `CUSTOMER_MEMORY_CAPABILITY`
- restaurant/POS/order/waiting/kitchen: `LEGACY_RESTAURANT_VERTICAL`
- Google Drive/R2/B2/GCS/payment/signature/SNS provider: 설계 또는 Owner Gate, 현재 비활성
