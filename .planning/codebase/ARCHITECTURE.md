# Architecture

**Analysis Date:** 2026-07-22 (Phase 7 — Next.js-only platform)

## Pattern Overview

**Overall:** Single Next.js process on the operator laptop with self-hosted Supabase and a provider-neutral AI integration.

**Key Characteristics:**

- Frontend serves public citizen UI and authenticated officer dashboard
- API routes implement ingestion, querying, analytics, and status transitions directly
- AI output is structured JSON and treated as advisory only
- Evidence lives in private Supabase Storage (`evidence_path` column)

## Layers

**Frontend UI (Next.js App Router):**

- Purpose: User-facing pages for citizens and officers
- Key locations: `frontend/src/app/[locale]/`, `frontend/src/app/dashboard/`

**Next.js API routes (server boundary):**

- Purpose: HTTP handlers for citizen submit, status lookup, officer CRUD, analytics, health
- Depends on: `frontend/src/server/` services and repositories
- Key locations:
  - `frontend/src/app/api/public/reports/analyze/route.ts`
  - `frontend/src/app/api/v1/reports/**`
  - `frontend/src/app/api/health/route.ts`, `frontend/src/app/api/ready/route.ts`

**Server modules (`frontend/src/server/`):**

- `repositories/` — Supabase Postgres queries (reports, analytics, tokens)
- `services/` — AI analysis, evidence upload/download, officer reads, citizen status
- `officer/guard.ts` — `requireOfficerContext()` via `getClaims()`
- `health/readiness.ts` — bounded Supabase probe for `/api/ready`

## Data Flow

**Citizen report submission:**

1. `ReportForm` posts to `/api/public/reports/analyze`
2. Route calls `analyzeAndPersistReport` in `report-service.ts`
3. Optional evidence uploads to private Storage; `evidence_path` stored on report row
4. Third-party AI returns structured analysis; report + hashed access token persisted atomically via RPC
5. Plaintext access token returned once in response

**Officer dashboard:**

1. Officer authenticates via Supabase Auth (`/login` → session cookies)
2. `proxy.ts` gates `/dashboard` using `getClaims()` + `app_metadata.role`
3. Dashboard loaders call server repositories directly (no FastAPI proxy)
4. Status updates and evidence images flow through `/api/officer/**` and `/api/v1/**` routes

## Security

- Citizen status: token-scoped lookup; uniform 401 on failure (anti-enumeration)
- Officer paths: user-scoped Supabase client from session JWT — never service role for reads
- Access tokens: SHA-256 hashed at rest; plaintext shown once at submit
- Production bind: loopback default (`127.0.0.1`); public exposure requires explicit operator decision

## Operations

- Liveness: `/api/health` (no external calls)
- Readiness: `/api/ready` (Supabase only)
- Backup/restore: `frontend/scripts/backup-citymind.*`, `restore-citymind.*`
- Startup: `frontend/scripts/register-citymind-task.ps1` (Windows Task Scheduler)

## Historical Note

Prior MVP used FastAPI + BigQuery + GCS + Cloud Run. Phase 7 removed those runtime paths.
Historical phase artifacts remain under `.planning/phases/`.
