# MyBizLab MVP

React 19 + Vite + Tailwind 4 based store operations demo app.

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

## Demo Scenarios

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

## Demo Flow Notes

- Default demo mode is `VITE_DATA_PROVIDER=local`.
- If local demo data looks stale after repeated flows, clear browser storage for the app or open a fresh browser profile.
- Public store, survey response, CRM inquiry, manual metrics, and AI insights all run against local mock data without external services.
- Firebase remains a separate adapter path and is not required for sales demos.

## Remaining Gaps

- Firebase-backed production flows still need service credentials and a live project; the local mock remains the primary demo path.
- Billing and webhook flows are demo-safe, but real payment verification still depends on external provider env and secrets.
- Dashboard and AI charts are owner-friendly mock visualizations, not a full BI replacement.
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
