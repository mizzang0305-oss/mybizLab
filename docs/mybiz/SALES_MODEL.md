# MyBiz Sales Model

## 첫 화면이 답해야 할 질문

1. 무엇인가: 결과형 서비스업을 위한 Business Service OS
2. 누구를 위한가: 작업 결과, 완료 증빙, 고객 확인이 중요한 서비스 업체
3. 어떻게 처리하는가: 한 건의 Job을 증빙·확인·대금·기록·성장으로 연결
4. 무엇을 지키는가: 누락된 작업 기록, 확인 혼선, 미수금 추적, 무단 홍보 위험을 분리 관리
5. 무엇이 쌓이는가: 작업 이력, 증빙, 고객 기억, 승인된 브랜드·콘텐츠 자산

## Revenue paths

### A. SaaS revenue

`Merchant → MyBiz subscription → MyBizLab`

구독 플랜은 FREE, PRO, VIP다. 실제 가격·entitlement 변경은 별도 Owner 승인 대상이다.

### B. Merchant service revenue

`End Customer → Service Payment → Merchant`

MyBiz는 `job_payment_requests`로 요청·상태를 추적하는 도메인을 갖지만 이번 단계에서 결제 provider나 실제 대금 이체를 활성화하지 않는다.

## Sales narrative

“사진을 모아주는 도구”가 아니라 “한 건의 일을 끝내고 증명하고 대금을 추적하고 다음 고객 자산으로 만드는 운영 시스템”으로 설명한다. 홈페이지는 선택형 성장 모듈이며 제품 전체가 아니다.

## Claims boundary

- 전자계약 CRUD는 인증된 전자서명 서비스가 아니다.
- 고객 확인은 결제 완료가 아니다.
- 콘텐츠 후보와 게시 검토함은 SNS 자동 게시가 아니다.
- AI 생성 결과는 업체 검토 없이 외부 공개되지 않는다.
