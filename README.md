# MyBiz — Business Service OS

MyBizLab이 만드는 **MyBiz**는 결과와 완료 증빙이 중요한 서비스업을 위한 Business Service OS입니다.

핵심 약속은 **“작업부터 다음 고객까지.”** 입니다. 고객/문의에서 시작한 한 건의 일을 작업, 선택형 계약, 증빙, 고객 확인, 대금 추적, 동의, 업체 검토, 브랜드·콘텐츠 자산, 고객 기억과 다음 고객까지 연결합니다.

```text
Customer / Lead → Job → optional Contract → Work → Evidence
→ Customer Confirmation → Payment Tracking → Evidence Package
→ Channel-specific Consent → Merchant Approval → Brand / Content Asset
→ Customer Memory → Next Customer
```

공개 V1 업종은 청소, 미용실, 설치·수리입니다. 가발과 인테리어·시공은 확장 템플릿이며, 의료 업종은 기본 비활성입니다. 업종별 앱을 복제하지 않고 하나의 Service OS 엔진에 `VerticalTemplate` 설정을 적용합니다.

제품 기준 문서:

- [`docs/mybiz/CANONICAL_PRODUCT.md`](docs/mybiz/CANONICAL_PRODUCT.md)
- [`docs/mybiz/MODULE_CATALOG.md`](docs/mybiz/MODULE_CATALOG.md)
- [`docs/mybiz/VERTICAL_TEMPLATE_POLICY.md`](docs/mybiz/VERTICAL_TEMPLATE_POLICY.md)
- [`docs/MYBIZ_STAGE2_PRODUCT_SPEC.md`](docs/MYBIZ_STAGE2_PRODUCT_SPEC.md)

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Keep `VITE_DATA_PROVIDER=local` for demo-safe local development unless you are wiring Firebase or legacy Supabase flows.
3. Install dependencies with `npm install`.
4. Start the frontend with `npm run dev`.

The app is designed to boot without external services. When env vars are missing, it falls back to local demo data instead of crashing.

## Verification Commands

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run clean`

## Runtime Modes

- `local`: bundled seed data plus browser storage. This is the default demo mode.
- `firebase`: reserved for Firebase Auth / Firestore / Storage-backed flows.
- `mock` and `supabase`: legacy values still accepted so older admin tests keep working.

## Demo Login

- One-click demo access works without extra env.
- Email/password demo login is optional and only appears when `VITE_DEMO_ADMIN_PASSWORD` is configured.
- Do not hardcode demo passwords in code. Keep them in env only when needed for a controlled demo.

## Legacy Restaurant Vertical Demo Scenarios

아래 음식점·카페 데모는 삭제 대상이 아니라 `LEGACY_RESTAURANT_VERTICAL` 호환 자산입니다. MyBiz 전체 제품 정체성이나 기본 온보딩·내비게이션을 정의하지 않습니다.

- `Golden Coffee`
  - Type: cafe
  - Public route: `/golden-coffee`
  - Owner story: order-first, order + survey, QR/table flow, AI brief
- `Mint Izakaya`
  - Type: izakaya
  - Public route: `/mint-izakaya`
  - Owner story: hybrid, order + survey + manual, inquiry and CRM follow-up
- `Seoul Buffet House`
  - Type: Korean buffet
  - Public route: `/seoul-buffet-house`
  - Owner story: survey-first, survey + manual, family feedback to AI insight

## Legacy Demo Flow Notes

- Default demo mode is `VITE_DATA_PROVIDER=local`.
- If local demo data looks stale after repeated flows, clear browser storage for the app or open a fresh browser profile.
- Public store, survey response, CRM inquiry, manual metrics, and AI insights all run against local mock data without external services.
- Firebase remains a separate adapter path and is not required for sales demos.

## Remaining Gaps

- Firebase-backed production flows still need service credentials and a live project; the local mock remains the primary demo path.
- Billing and webhook flows are demo-safe, but real payment verification still depends on external provider env and secrets.
- 일부 기존 Dashboard와 AI 차트는 restaurant vertical용 호환 데모이며 완전한 BI를 의미하지 않습니다.
- Some platform console screens go broad on coverage and are intentionally lighter than a production back-office.
- Existing browser storage from older seeds may keep previous demo labels until the storage snapshot is reset.

## Project Structure

```text
api/
  ai/
  billing/
src/
  app/
  integrations/
    firebase/
    supabase/
  modules/
  server/
  shared/
    components/
    hooks/
    lib/
      data/
      env/
    types/
  tests/
supabase/
  schema.sql
```

## Environment Variables

Browser-exposed Vite envs:

- `VITE_APP_BASE_URL`
- `VITE_DATA_PROVIDER`
- `VITE_DEMO_ADMIN_EMAIL`
- `VITE_DEMO_ADMIN_PASSWORD`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `NEXT_PUBLIC_PORTONE_STORE_ID`
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
- `VITE_PORTONE_STORE_ID` and `VITE_PORTONE_CHANNEL_KEY` as compatibility fallbacks
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

Server-only envs:

- `PORTONE_API_SECRET`
- `PORTONE_WEBHOOK_SECRET`
- `PORTONE_STORE_ID`
- `PORTONE_CHANNEL_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## PortOne Webhook

- Production endpoint: `https://mybiz.ai.kr/api/billing/webhook`
- Local endpoint with Vercel dev: `http://localhost:3000/api/billing/webhook`
- `npm run dev` serves only the Vite frontend. Use `vercel dev` when testing `/api/*` locally.
- `/api/billing/webhook` requires `PORTONE_WEBHOOK_SECRET`.
- Known `Transaction.*` and `BillingKey.*` events are re-verified with `PORTONE_API_SECRET`.
- Unknown webhook events are ignored with HTTP 200 so delivery is not blocked.
