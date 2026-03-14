# My Biz Lab MVP

React 19 + Vite + Tailwind 4 기반의 매장 운영 SaaS MVP입니다.

## 실행

1. `.env.example`를 `.env.local`로 복사합니다.
2. 필요한 환경변수를 채웁니다.
3. 의존성을 설치합니다.
   `npm install`
4. 프런트 개발 서버를 실행합니다.
   `npm run dev`

기본 데이터 모드는 `mock`이며, 별도 백엔드가 없어도 주요 화면을 확인할 수 있습니다.

## 스크립트

- `npm run dev`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run clean`

## 주요 구조

```text
api/
  billing/
src/
  app/
  integrations/
  modules/
  pages/
  server/
  shared/
supabase/
  schema.sql
```

## 환경 변수

- `VITE_APP_BASE_URL`
- `VITE_DATA_PROVIDER`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_GEMINI_API_KEY`
- `GEMINI_API_KEY`
- `PORTONE_WEBHOOK_SECRET`

## PortOne Webhook

- Production endpoint: `https://mybiz.ai.kr/api/billing/webhook`
- Local endpoint: `http://localhost:3000/api/billing/webhook`
- 현재 프런트 개발용 `npm run dev`는 Vite 정적 서버만 띄우므로 `/api/*`를 제공하지 않습니다.
- 로컬에서 웹훅까지 함께 테스트하려면 `vercel dev` 또는 Vercel preview 배포를 사용해야 합니다.
- PortOne V2 웹훅은 `POST` 전용이며 `webhook-id`, `webhook-signature`, `webhook-timestamp` 헤더를 검증합니다.
- `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있으면 `billing_webhook_events`, `billing_webhook_states` 테이블에 저장합니다.
- Supabase service role이 없으면 메모리 기반 placeholder 저장소로 처리되며, 로그는 함수 인스턴스 범위에서만 유지됩니다.
