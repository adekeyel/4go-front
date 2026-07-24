# forego (4GO) — Frontend

React + Vite + TypeScript frontend, backed by Supabase (see the separate `backend` package for edge functions and migrations).

## Setup

```
npm install
npm run dev
```

## Environment variables

See `.env` — requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test` — unit tests (Vitest)
- `npx playwright test` — e2e tests (add specs under `e2e/`)

## Notes

This project was originally scaffolded with Lovable. All Lovable-specific packages
(`lovable-tagger`, the Lovable-managed Playwright config) and hardcoded
`*.lovable.app` URLs have been removed/replaced so it can be built and deployed
independently.
