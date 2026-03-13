# My Biz Lab MVP

Vite + React 19 + Tailwind 4 기반의 스토어 운영 SaaS MVP 예제입니다.

핵심 시나리오:

- 스토어 온보딩 신청/생성
- `store_id` 기반 운영 대시보드
- 주문 / 고객 / 예약 / 웨이팅 / 설문 / 계약 / 매출 / 브랜드 관리
- `slug` 기반 공개 스토어 주소와 QR 주문
- 주방 보드 반영 및 주문 완료 시 `sales_daily` 집계
- Gemini 2.5 Flash 연결 가능한 AI 점장 / AI 리포트

## 실행

1. `.env.example`을 `.env.local`로 복사합니다.
2. 의존성을 설치합니다.
   `npm install`
3. 개발 서버를 실행합니다.
   `npm run dev`

기본 데이터 모드는 `mock`이며, 로컬에서도 핵심 MVP 플로우를 바로 확인할 수 있습니다.

## 스크립트

- `npm run dev`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run clean`

## 주요 구조

```text
src/
  app/
  modules/
  shared/
  integrations/
  pages/
supabase/
  schema.sql
```

## 환경 변수

- `VITE_APP_BASE_URL`
- `VITE_DATA_PROVIDER`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`
- `GEMINI_API_KEY` (server proxy 전용)
