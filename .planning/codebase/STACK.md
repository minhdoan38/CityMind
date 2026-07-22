# Technology Stack

**Analysis Date:** 2026-07-22 (Phase 7 — Next.js-only platform)

## Languages

- TypeScript 5.x — Frontend Next.js app (UI + server/API routes)
- SQL — Supabase migrations and live contract tests

## Runtime

- Node.js 22 — Direct laptop production process (`next build` / `next start`)
- npm — `frontend/package-lock.json`, `npm ci` for reproducible installs

## Frameworks

- Next.js 16.2.10 — App Router UI and API route handlers
- Vitest — Frontend unit tests
- node:test — Legacy contract tests (`frontend/tests/*.test.mjs`)
- TypeScript 5.x — Type checking
- ESLint 9.x (`eslint-config-next`) — Linting

## Key Dependencies

- `@supabase/ssr` / `@supabase/supabase-js` — Auth, Postgres, Storage from Next.js
- `next-intl` — Bilingual EN/VI public routes
- `react-hook-form` + `zod` — Citizen report form validation
- `recharts` — Officer analytics charts
- `maplibre-gl` / `react-map-gl` — Dashboard map view

## Configuration

Frontend (`frontend/.env.example` / `frontend/.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser + SSR
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only admin operations
- `SUPABASE_DB_URL` — migrations and SQL contract runner
- `THIRD_PARTY_API_KEY`, `AI_BASE_URL`, `AI_MODEL` — provider-neutral AI
- `SMOKE_HOST`, `SMOKE_PORT` — loopback production smoke defaults

## Platform Requirements

- Node.js 22+
- Self-hosted Supabase (Postgres 15+, Auth, private `evidence` bucket)
- Supabase CLI for `supabase db push`
- Windows Task Scheduler (optional) via `frontend/scripts/register-citymind-task.ps1`

## Removed (Phase 7)

- Python / FastAPI / uvicorn
- BigQuery, GCS, Vertex AI SDKs
- Docker Compose and Cloud Run deployment scripts
- `BACKEND_API_URL` / FastAPI proxy bridge

**Exception:** Google Fonts via `frontend/src/lib/fonts.ts` (`next/font/google`).
