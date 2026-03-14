# My Biz Lab MVP

React 19 + Vite + Tailwind 4 based SaaS MVP.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill in the required environment variables.
3. Install dependencies with `npm install`.
4. Start the frontend with `npm run dev`.

The default data source is `mock`, so the app can run without external services.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run clean`

## Project structure

```text
api/
  billing/
src/
  app/
  integrations/
  modules/
  server/
  shared/
supabase/
  schema.sql
```

## Environment variables

### Browser public envs

These values are exposed to the browser through Vite. The preferred PortOne names are
`NEXT_PUBLIC_*`, and this app still accepts `VITE_*` as a compatibility fallback.

- `VITE_APP_BASE_URL`
- `NEXT_PUBLIC_PORTONE_STORE_ID`
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
- `VITE_PORTONE_STORE_ID` (fallback)
- `VITE_PORTONE_CHANNEL_KEY` (fallback)
- `VITE_DATA_PROVIDER`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

### Server-only envs

These values must never be exposed with a `VITE_` prefix.

- `PORTONE_API_SECRET`
- `PORTONE_WEBHOOK_SECRET`
- `PORTONE_STORE_ID`
- `PORTONE_CHANNEL_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## Vercel setup

Register these variables in Vercel Project Settings > Environment Variables for Development, Preview, and Production:

- `VITE_APP_BASE_URL`
- `PORTONE_API_SECRET`
- `PORTONE_WEBHOOK_SECRET`
- `PORTONE_STORE_ID`
- `PORTONE_CHANNEL_KEY`
- `NEXT_PUBLIC_PORTONE_STORE_ID`
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`

Add the Supabase and Gemini variables too if those integrations are enabled in that environment.

## PortOne webhook

- Production endpoint: `https://mybiz.ai.kr/api/billing/webhook`
- Local endpoint with Vercel dev: `http://localhost:3000/api/billing/webhook`
- `npm run dev` serves only the Vite frontend. It does not run `/api/*`.
- Use `vercel dev` or a Vercel Preview deployment when testing PortOne webhooks locally.
- `/api/billing/webhook` requires `PORTONE_WEBHOOK_SECRET` for signature verification.
- `/api/billing/webhook` re-verifies known `Transaction.*` and `BillingKey.*` events by calling PortOne with `PORTONE_API_SECRET`.
- Unknown webhook event types are ignored and return `200` so Standard Webhooks delivery is not blocked.
